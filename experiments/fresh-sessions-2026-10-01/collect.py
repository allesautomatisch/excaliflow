"""Read one explicitly selected experiment's log; never send hints to its agent."""
import argparse
import json
import pathlib
import re

parser = argparse.ArgumentParser()
parser.add_argument("rollout")
parser.add_argument("directory")
args = parser.parse_args()
destination = pathlib.Path(args.directory)
destination.mkdir(parents=True, exist_ok=True)
rows = [json.loads(line) for line in pathlib.Path(args.rollout).read_text().splitlines()]
calls, responses, messages, commands, contexts = [], [], [], [], []
decoder = json.JSONDecoder()
def flow_values(value):
    if isinstance(value, dict):
        if "ok" in value and "contractVersion" in value:
            return [value]
        return [item for child in value.values() for item in flow_values(child)]
    if isinstance(value, list):
        return [item for child in value for item in flow_values(child)]
    if isinstance(value, str):
        try:
            return flow_values(json.loads(value))
        except json.JSONDecodeError:
            found, cursor = [], 0
            while True:
                match = re.search(r'\{\s*"[A-Za-z_][^"]*"\s*:', value[cursor:])
                if match is None:
                    return found
                start = cursor + match.start()
                try:
                    child, length = decoder.raw_decode(value[start:])
                    found.extend(flow_values(child))
                    cursor = start + length
                except json.JSONDecodeError:
                    cursor = start + 1
    return []

for row in rows:
    payload = row.get("payload", {})
    if row["type"] == "turn_context":
        contexts.append({key: payload.get(key) for key in ("cwd", "model", "effort")})
    if row["type"] != "response_item":
        continue
    item_type = payload.get("type")
    if item_type in ("function_call", "custom_tool_call"):
        calls.append({"timestamp": row["timestamp"], **payload})
        source = payload.get("arguments", payload.get("input", ""))
        if "exec_command" in str(source):
            commands.append(source)
    if item_type == "message":
        messages.append(payload)
    if item_type not in ("function_call_output", "custom_tool_call_output"):
        continue
    output = payload.get("output", "")
    parts = output if isinstance(output, list) else [{"text": str(output)}]
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    objects = []
    for text in texts:
        cursor = 0
        while True:
            match = re.search(r'\{\s*"[A-Za-z_][^"]*"\s*:', text[cursor:])
            if match is None:
                break
            start = cursor + match.start()
            try:
                value, length = decoder.raw_decode(text[start:])
                objects.extend(flow_values(value))
                cursor = start + length
            except json.JSONDecodeError:
                cursor = start + 1
    responses.append({"timestamp": row["timestamp"], "call_id": payload.get("call_id"),
                      "text": texts, "flow_objects": objects})

flow_objects = [value for response in responses for value in response["flow_objects"]]
initial = next((value for value in flow_objects if "total" in value), None)
final_context = next((value for value in reversed(flow_objects) if "total" in value), None)
successful_batches = [value for value in flow_objects if value.get("ok") and "results" in value]
nodes, edges = {}, {}
for batch in successful_batches:
    for result in batch["results"]:
        for element in result.get("elements", []):
            element_id = element.get("id")
            if element.get("deleted"):
                nodes.pop(element_id, None)
                edges.pop(element_id, None)
            elif element.get("kind") == "node":
                nodes[element_id] = {**nodes.get(element_id, {}), **element}
            elif element.get("kind") == "edge":
                edges[element_id] = {**edges.get(element_id, {}), **element}
complete = next((row["payload"] for row in reversed(rows)
                 if row["type"] == "event_msg" and row.get("payload", {}).get("type") == "task_complete"), None)
labels = [node.get("text", "") for node in nodes.values()]
native_calls = []
for call in calls:
    source = call.get("arguments", call.get("input", ""))
    try:
        source = json.loads(source).get("code", source)
    except (json.JSONDecodeError, AttributeError):
        pass
    native_calls.extend(re.findall(r"call\(['\"](flow_(?:get_context|help|apply_operations))(?:__[^'\"]+)?['\"]", str(source)))
summary = {
    "contexts": contexts,
    "completed": complete,
    "empty_start_proven": bool(initial and initial.get("ok") and initial.get("total") == 0),
    "contract_versions": sorted({value.get("contractVersion", "") for value in flow_objects}),
    "successful_batches": len(successful_batches),
    "flow_errors": [value["error"] for value in flow_objects if not value.get("ok") and "error" in value],
    "help_calls_returned": sum("operation" in value for value in flow_objects),
    "labels": labels,
    "two_word_labels": sum(len(label.split()) == 2 for label in labels),
    "node_geometry_standard": bool(nodes) and all(node.get("width") == 120 and node.get("height") == 120
        and node.get("x", 1) % 120 == 0 and node.get("y", 1) % 120 == 0 for node in nodes.values()),
    "nodes_from_committed_results": list(nodes.values()),
    "edges_from_committed_results": list(edges.values()),
    "last_context": final_context,
    "full_final_geometry_available": bool(final_context and final_context.get("total", 0) > 0
        and final_context.get("nextOffset") is None
        and len(final_context.get("elements", [])) == final_context["total"]
        and all("x" in element for element in final_context.get("elements", []))),
    "call_count": len(calls),
    "named_webmcp_calls_in_inputs": {name: native_calls.count(name) for name in sorted(set(native_calls))},
    "observer_note": "Committed results reconstruct labels/bindings/returned node positions; they do not guarantee complete final edge geometry.",
}
for name, value in (("calls", calls), ("responses", responses), ("messages", messages), ("summary", summary)):
    (destination / f"{name}.json").write_text(json.dumps(value, ensure_ascii=False, indent=2))
print(json.dumps({key: value for key, value in summary.items()
                 if key not in ("nodes_from_committed_results", "edges_from_committed_results", "last_context")},
                 ensure_ascii=False, indent=2))
