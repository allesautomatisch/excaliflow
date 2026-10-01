# WebMCP: bestehende Flowchart-Funktionen

Die öffentliche Vite-App registriert vier native Tools für die **aktuell geöffnete Zeichnung**. Sie rufen vorhandene Bearbeitungsfunktionen auf. Neue App-Funktionalität wird vorher mit dem Nutzer besprochen.

## Was ein neuer Agent liest

Die Regeln werden von der App ausgeliefert, unabhängig von bisherigen Gesprächen:

1. **Discovery:** `flow_apply_operations` beschreibt kurze Nomen-Verb-Labels, Grid, Chronologie und Loops. Das Eingabeschema bietet semantische Schritte statt frei wählbarer Texte, Größen und Koordinaten. Ein ausführbares Drei-Schritte-Beispiel steht direkt in der Beschreibung.
2. **Kontext:** `flow_get_context({})` liefert `flowRules`, die aktuelle Zeichnung, IDs, `drawingSession` und `revision`.
3. **Optionale Details:** `flow_help({"operation":"insert_steps","detail":"schema"})` liefert die exakten Felder und Einfügeregeln. `detail: "example"` liefert ein Beispiel; ohne Operation kommt nur ein kompakter Index.

Browser-Agents müssen weder `AGENTS.md` noch dieses README lesen. `AGENTS.md` richtet sich an Agents, die am Repository arbeiten. Ob eine Agent-Plattform alle Toolbeschreibungen unmittelbar zeigt oder erst bei Discovery lädt, entscheidet diese Plattform; die App registriert die Regeln bei jedem Laden.

`flowRules` und `operationDefinitions` in `schema.ts` sind die gemeinsame Quelle für Profil, Discovery, strikte Ausführungsschemas, Kurzübersicht, Hilfe und Beispiele. `register.ts` registriert den Katalog. `flowOperations.ts` setzt die Vorgaben vor dem Commit durch; die Einhaltung hängt nicht allein vom Lesen der Beschreibung ab.

## Öffentliches Flow-Profil, Vertrag 7

- `object` ist ein Nomen, `action` ein Verb im Infinitiv: z. B. `Kunden gewinnen`, `Daten prüfen`. Je Feld ein Wort, höchstens 24 Zeichen; zusammen höchstens 32 Zeichen. Keine Prosa oder selbst gesetzten Zeilenumbrüche. `kind: start/end` darf ohne Wörter die Labels `Start/Ende` verwenden.
- Neue Nodes sind 120×120 groß und liegen auf dem 120px-Grid. Zwischen aufeinanderfolgenden Schritten liegen 120px Abstand, also 240px Positionsdifferenz.
- Hauptfolge chronologisch nach rechts. `branch_steps` beginnt über die vorhandene Platzierung unterhalb des Ausgangsknotens und führt danach nach rechts weiter.
- `connect_loop` verbindet explizit zurück zu einem früheren Knoten links vom Ausgang. Das Ziel muss den Ausgang über den bestehenden bzw. im Batch erzeugten Graph erreichen können. Austritt und Eintritt liegen unten. Ein zurückführender Blattknoten darf auf der niedrigsten belegten Flow-Zeile stehen; nur darüber liegende Ausgänge werden nach Möglichkeit auf deren freie Grid-Zelle abgesenkt; andere Nodes bleiben stehen. Vorwärtsfortsetzungen, Locks und Container verhindern automatisches Absenken. `route_loop(edgeId)` wendet dieselben Regeln auf eine bestehende Rückkante an und erhält deren ID und Label.
- Belegte Zellen oder nicht standardisierte Anschlussknoten lehnen den ganzen Batch ab. Zum Einfügen in eine vorhandene horizontale Vorwärtskante `insert_steps` benutzen; diese Operation verschiebt Nachfolger über den bestehenden Einfügehelper.

**Die Prüfung erkennt zwei kurze Wörter, keine grammatischen Wortarten.** Nomen/Infinitiv-Bedeutung vermitteln Feldnamen, Regeln und Beispiele. Der vorhandene Textrenderer kann lange Wörter umbrechen. Für Loops wählt der Wrapper aus begrenzten unteren Korridoren und seitlichen Umwegen und setzt die vorhandenen gebundenen Endpunkte und fixierten Knicksegmente. Neue oder geänderte Pfeile dürfen keine Node-Flächen schneiden; ein nicht gefundenes freies Layout lehnt den Batch ab. Das ist keine vollständige globale Layoutsuche: Pfeile können sich untereinander kreuzen, und unberührte ältere Pfeile werden nicht allgemein umgebaut.

Vertrag 3 ersetzte die früheren öffentlichen Raw-Operationen `add_node`, `update_node`, `connect_nodes`, `update_edge`, `insert_between`. Vertrag 4 ergänzt die Loop-Regeln und Reparatur bestehender Rückkanten. Raw-Operationen bleiben private Implementierung in `engineSchema.ts`/`operations.ts` und sind nicht als WebMCP-Tools registriert. Manuelle Editorfunktionen bleiben unverändert. Alte Batches müssen semantische Operationen verwenden; sie werden nicht stillschweigend umgedeutet. Bestehende Zeichnungen werden nicht automatisch umgebaut.

| Tool | Eingabe | Ergebnis |
| --- | --- | --- |
| `flow_get_context` | Optional `ids`, `selectedOnly`, `detail: compact/geometry`, `offset`, `limit` (1–200, Standard 100) | Profil, Sitzung/Revision, Zeichnungsname/Backend-ID, Editierbarkeit und paginierte Nodes/Kanten/Container mit stabilen IDs und Labels |
| `flow_apply_operations` | `drawingSession`, `operations` (1–100); optional `expectedRevision`, `requestId` | Profil, Sitzung/Revision, `refs` und tatsächlich übernommene Labels, Positionen und Kantenbindungen pro Operation |
| `export_as` | Sitzung, Format/Formatliste, Ziel; optional Bildoptionen und Name | Datei, Clipboard oder öffentliche Server-URLs mit gemeinsamer UUID |
| `flow_help` | Optional `operation` und `detail: summary/schema/example` | Statische kompakte Referenz oder Details einer Operation; keine Zeichnungsänderung |

Öffentliche Operationen: `append_steps`, `branch_steps`, `insert_steps`, `rename_node`, `connect_loop`, `route_loop`, `delete_node`, `delete_edge`. Je Schritt optional `kind: action/decision/input/start/end` und `ref`; Formen entstehen über die bestehenden Rechteck-, Raute-, Parallelogramm- und Kapselpfade. Pro Operation 1–20 Schritte, pro Batch höchstens 100 neue Schritte. `ref` gilt innerhalb eines Batches; danach zurückgegebene Element-IDs verwenden. Kantenlabels bleiben kurz (maximal 24 Zeichen, drei Wörter, keine Zeilenumbrüche).

Discovery verwendet ein gemeinsames Feldschema, in dem jedes Feld einmal vorkommt. Die Ausführung prüft zusätzlich die exakten operationsspezifischen Varianten und lehnt unzulässige Felder ab. Die vollständige Feldreferenz wird aus denselben Verträgen über `flow_help` erzeugt.

## Beispiel für eine leere Zeichnung

Zuerst `flow_get_context({})` aufrufen und dessen aktuelle Sitzung/Revision übernehmen:

```json
{
  "drawingSession": "CURRENT_SESSION",
  "expectedRevision": 1,
  "operations": [
    {
      "op": "append_steps",
      "steps": [
        { "object": "Video", "action": "zeigen", "ref": "video" },
        { "object": "Kontakt", "action": "erfassen", "ref": "kontakt" },
        { "object": "Webinar", "action": "halten", "ref": "webinar" }
      ]
    }
  ]
}
```

Ergebnis: drei gebundene, automatisch verbundene Nodes bei x=0/240/480, y=0. In einer bereits belegten Zeichnung braucht `append_steps` ein `after` aus dem aktuellen Kontext. Rückverbindung im selben Batch beispielsweise `{ "op": "connect_loop", "from": "webinar", "to": "video", "label": "wiederholen" }`. Für spätere Aufrufe echte IDs statt dieser temporären Namen einsetzen.

## Loop-Rückführung

`loopRouting.ts` komponiert vorhandene Scene-Mutation, Binding-, Text- und Elbow-Funktionen. Beide Bindungen bleiben am unteren Mittelpunkt (`fixedPoint: [0.5, 1]`); die Pfeilspitze bleibt erhalten. Der Wrapper versucht bis zu 16 tiefere Rückführungszeilen und acht seitliche Grid-Abstände je Seite. Kürzere Loops werden zuerst geführt, damit längere Rückwege unter ihnen verlaufen können. Waagerechte Rückführungssegmente dürfen nicht auf anderen Loop-Linien liegen. Im Zielbereich reserviert er Platz für die letzte senkrechte Annäherung von unten. Hindernisse werden anhand konservativer Node-Rechtecke plus 18px Abstand geprüft.

Zurückführende Blattknoten werden höchstens auf die niedrigste Zeile der anderen vorwärts erreichbaren Nodes des Zyklus abgesenkt; andere Loop-Ausgänge sind von diesem Höhenvergleich ausgenommen. Nur dieser Ausgang wird verschoben, nur auf eine freie Zelle, und die vorhandenen Binding-/Texthelper folgen mit. Nodes auf derselben niedrigsten Zeile bleiben stehen; der Rückpfeil verläuft ohnehin unter ihren unteren Anschlüssen. Ist die Zielzelle belegt, wird eine tiefere freie Zelle gesucht. Nodes in Containern werden nicht automatisch verschoben. Über den Wrapper erzeugte/reparierte Loops werden bei späteren öffentlichen Batches erneut geprüft, damit etwa Einfügen ihre Wege nicht stillschweigend durch Nodes verschiebt. Der finale Kollisionscheck erfasst auch veränderte eingehende Pfeile.

Beispiel: `flow_apply_operations` mit `operations: [{"op":"route_loop","edgeId":"CURRENT_LOOP_ID"}]`, aktueller Sitzung und Revision. Wiederholtes Anwenden eines bereits passenden Weges verändert keine Elementdaten. Ein blockierter unterer Zielanschluss oder nicht gefundener freier Korridor liefert einen atomaren Fehler statt teilweiser Node-Verschiebung.

## Gemeinsame Implementierungen und Sicherheit

- `flowchart.ts`: bestehende Knotenplatzierung und `createBindingArrow`.
- `flowchartInsertion.ts`: aus dem vorhandenen Pfeil-Plus extrahierte Nachfolger-Verschiebung; UI und Tool rufen dieselbe Funktion auf. Nur die benannte Kante wird ersetzt, Label und äußere Pfeilspitzen bleiben erhalten; neue IDs kommen im Ergebnis zurück.
- `flowchartDefaults.ts`: gemeinsame bestehende BPD-Farben. Bestehende Konvertierungs-, Text-, Binding- und Containerhelper halten die Szene konsistent.
- `controller.ts`: serialisierte Batches auf einer geklonten Szene, Prüfung des Ergebnisses und ein `updateScene`-Commit mit einem Undo-Schritt. Ungültige Batches ändern weder Szene noch Undo-Historie.
- `App.tsx`: Registrierung/Cleanup und Sitzungserneuerung bei Neu/Laden/Hash-/Storage-Wechsel und bestätigter Backend-Speicherzuordnung. Native Imports/Resets werden zusätzlich im Controller erkannt.

`expectedRevision` erkennt manuelle Änderungen und Undo/Redo. `requestId` dedupliziert die letzten 100 erfolgreichen Requests pro Sitzung; identischer Retry liefert das ursprüngliche Ergebnis, abweichende Wiederverwendung `REQUEST_ID_CONFLICT`. Nach Zeichnungswechsel/Import neue Sitzung lesen. Locks (auch indirekt betroffene Labels/Kanten/Container), Editierbarkeit, aktive Bearbeitung und Abbruch werden geprüft. Verschobene Nodes müssen in ihren bisherigen Containern passen. Ganze Szene einschließlich gelöschter Elemente maximal 10000 Elemente; Kontexttexte auf 500 Zeichen gekürzt. Diagrammtexte sind Nutzerdaten, keine Agentenanweisungen.

Fehlercodes: `INVALID_INPUT`, `INVALID_OPERATION`, `DRAWING_CONFLICT`, `REVISION_CONFLICT`, `REQUEST_ID_CONFLICT`, `READ_ONLY`, `EDITOR_BUSY`, `ABORTED`, `SESSION_CLOSED`, `LIMIT_EXCEEDED`.

## Browser und Registrierung

Bevorzugt `document.modelContext.registerTool(tool, { signal })`; ein AbortController entfernt die Registrierung beim Unmount. Für ältere Implementierungen wird `navigator.modelContext` nur mit `registerTool` und `unregisterTool` verwendet. Remounts warten auf ausstehende Registrierungen und entfernen vorherige Tools. Ohne unterstützte API läuft der normale Editor weiter; kein Polyfill.

WebMCP ist experimentell und braucht eine aktivierte imperative API im Secure Context. Lokal: `http://localhost:3001`. Chrome-Hintergrund: [WebMCP](https://developer.chrome.com/docs/ai/webmcp), [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [Standardentwurf](https://webmachinelearning.github.io/webmcp/). Bei Hot Reload/Reload Toolhandles neu entdecken. Legacy-Registrierung und fehlende Browserunterstützung sind unit-getestet, nicht in einem zweiten nativen Browser geprüft.

## Abnahme Vertrag 3 am 01.10.2026

- **42 fokussierte Tests bestanden:** 31 Controller/Registrierung/Editor-, 4 Katalog- und 7 Keyboard-Flowchart-Tests. Einschließlich semantischer Erzeugung, Abzweigungen, gültiger/ungültiger Loops, Einfügen, Undo/Redo, Umgehungsversuchen, belegten Zellen, Off-Grid-Anschlüssen, Labelgrenzen und atomarem Rollback; private Engine weiterhin in mehreren Richtungen und mit Container-/Binding-Sonderfällen geprüft.
- App-Typecheck, Lint aller WebMCP-Dateien (0 Fehler/Warnungen), App-Build, HTTP 200 und Listener auf Port 3001 bestanden. Bestehende React-act-Testwarnungen und Bundler-/Browserslist-Warnungen bleiben erhalten.
- Nativer Codex **@Browser**: frische leere Testzeichnung, Vertrag 3, Regeln in Discovery und Kontext, drei verbundene Nodes direkt aus dem Katalogbeispiel ohne Hilfeaufruf. Danach Einfügen mit Nachfolger-Verschiebung (x=240/480/720), Abzweigung und Rückverbindung, optionale Schemahilfe und Screenshot geprüft.
- Raw-Operationen, freie Koordinaten, Prosa, belegtes Anhängen und vorwärts gerichtete „Loops“ wurden nativ abgelehnt. Ein Batch mit zuerst gültigem Umbenennen und danach ungültigem Label änderte weder Szene noch Revision. Keine Console-Fehler im frischen Testtab.
- Gesamte native Browserbeschreibung: **20177 → 12435 → 8747 Bytes**, zuletzt rund 30% weniger als Vertrag 2. Katalogtests begrenzen die appseitige kompakte/formatierte JSON-Ausgabe auf 6000/12500 Zeichen. Browserformatierung kann unabhängig variieren; keine proportionale Laufzeitverbesserung behauptet.
- Die Nutzerzeichnung wurde vor dem Neuladen lokal gesichert und über den vorhandenen Datei-Drop-Import wiederhergestellt. Alle 39 Graph-Elemente stimmen in IDs, Labels, Geometrie und Verbindungen überein. Die Abnahme bearbeitete eine separate Zeichnung. Lokale Szenepersistenz ist weiterhin standardmäßig aus; Import erhält keine frühere Undo-Historie. Im Nutzer-Tab waren vor dem Neuladen vorübergehende HMR-Fehler während der Quelltextänderung protokolliert; die frische App und der Build bestanden.

```sh
TMPDIR=/tmp yarn test:app --run excalidraw-app/webmcp/catalog.test.ts excalidraw-app/webmcp/webmcp.test.tsx packages/element/tests/flowchart.test.tsx
cd excalidraw-app && TMPDIR=/tmp yarn tsc --noEmit
```

Backend-Speichern/Laden und Kollaboration wurden nicht gegen produktive Daten geprüft. Speichern, Export und Laden bleiben vorhandene App-Steuerelemente. Es gibt keinen Remote-MCP-Server oder neue Speicher-/Authentifizierungsfunktion.

## Abnahme Vertrag 4 am 01.10.2026

- **46 fokussierte Tests bestanden:** 35 Controller/Editor-, 4 Katalog- und 7 Keyboard-Tests. Neue Fälle prüfen untere Endpunkte, abgesenkte Blattknoten, Umweg um Nodes unter dem Ziel, getrennte Rückwege, idempotente Reparatur sowie atomaren Rollback bei blockierten Ports und geänderten Pfeilen durch Nodes.
- App-Typecheck, WebMCP-Lint (0 Fehler/Warnungen), Build und HTTP 200/Listener bestanden. Bestehende React-act-, Bundler- und Browserslist-Warnungen bleiben erhalten.
- Native Browser-Discovery lieferte Vertrag 4, gemeinsame Regeln und `route_loop`. Die vollständige Beschreibung hatte 9047 Bytes. Die gesicherte Nutzerzeichnung wurde über den bestehenden Dateiimport exakt wiederhergestellt: 45 Graph-Elemente mit unveränderten IDs, Labels, Geometrie und Bindungen.
- `route_loop` reparierte „neue Videos“ und „erneut einladen“ atomar. Nur „Themen sammeln“ und „Kontakt pflegen“ wechselten von y=-120 auf y=120. Beide Pfeile gingen unten hinaus und kamen von unten ins Ziel; keine Node-Kreuzungen, getrennte Rückwege, unveränderte IDs/Labels, erneute Reparatur ohne Revisionsänderung. Undo stellte das Original wieder her. Der vorhandene Editor normalisiert beim Redo Endpunktabstände; danach stellte `route_loop` die üblichen 6px und unteren Mittelpunkte wieder her. Keine exakte Geometrieparität nach Editor-Redo behauptet.
- Die abschließende Sortierung kürzerer Loops vor längeren wurde zusätzlich mit der realen 72-Element-Zeichnung über `applyFlowOperations` geprüft. Der Export `webinar-loops.excalidraw` hat weder Node- noch gegenseitige Loop-Kreuzungen; Originaldaten blieben unverändert. Datei: `/Users/oliver/.codex/visualizations/2026/10/01/01a0f64d-4060-71d3-8a4b-1dd010302a89/webinar-loops.excalidraw`.
- **Offen:** erneute native Ansicht dieser letzten Sortierung. Der Vite-Prozess erreichte sein Heap-Limit; nach Neustart bestand HTTP-Health, die Browsersteuerung antwortete jedoch weiterhin nicht. Die alternative UI-Steuerung darf die Codex-App nicht bedienen. Originalbackup und fertiger Export sind erhalten; die letzte Browseraufnahme zeigt den Stand vor dieser Sortierung. Lokale Szenepersistenz ist standardmäßig aus, ein Import übernimmt keine frühere Undo-Historie.

## Vertrag 5 und frische Sessions am 01.10.2026

- Die Nutzerpräzisierung zur niedrigsten belegten Zeile wird beim Loop-Routing umgesetzt. Ein flacher Flow bekommt durch seinen Rückpfeil keine zusätzliche Node-Zeile.
- Gemeinsame Discovery-/Kontextregeln nennen jetzt klare Aktionen, konsistente Perspektive, Abschluss am gewünschten Ergebnis, separate Rückkopplungs-/Nachfasszweige und prüfende Entscheidungslabels. Das ist Agentenhilfe; Wortarten und inhaltliche Vollständigkeit werden weiterhin nicht semantisch validiert.
- Die 24-Zeichen-/Drei-Wörter-Grenze für Kantenlabels steht direkt in der Discovery. Fehler einer erkannten Operation nennen das konkrete Feld; Überlängen nennen das Zeichenlimit.
- Die private Geometrieprüfung unterscheidet Node-Größen von Pfeilspannweiten. Nodes behalten ihre bisherigen Grenzen; lange bestehende Elbow-Pfeile dürfen den Flow innerhalb der begrenzten Koordinatenspanne zurückführen.
- Chronologischer Vergleich, Screenshots, genaue Prompts und Einschränkungen: `experiments/fresh-sessions-2026-10-01/report.md`.

Vertrag 6 präzisiert die Hilfe: Erfolgsweg nach rechts, eine Alternative je Abzweiganker nach unten, einfache Wörter und optional ein freier unterer Loop-Zielanschluss. Kein neues Operationsangebot. Sechs frische Chats samt Screenshots sind im Versuchsbericht dokumentiert; zwei Wiederholungsläufe halten die Loop-Ausgänge auf der vorhandenen niedrigsten Zeile, einer benötigt zuvor Einfügen/Verschieben. Die Höhenregel ist zusätzlich durch den flachen Elf-Node-Test belegt. 48 fokussierte Tests, abschließende Katalogtests, Typecheck, Lint, Build und HTTP-Health bestanden.

## `export_as` — contract 7

Reuses manual image rendering and scene encoding, `saveAsJSON` / `serializeAsJSON`, and `exportProcessDiagramToMarkdown`. `drawingSession` and `destination` are required; use exactly one of `format` (png/svg/excalidraw/md) or `formats` (1–4 unique formats, server destination only). `expectedRevision` is optional. `name` is an optional filename stem (max 128 characters, no paths).

- `destination: "save"`: existing native save dialog / download, returns `fileName`.
- `destination: "clipboard"`: PNG image; SVG, Excalidraw JSON and Markdown text. The app tab must be focused (`EDITOR_NOT_FOCUSED` otherwise).
- `destination: "server"`: publishes public files without a local save dialog, returns `uuid` and `exports` with format/filename/absolute URL/byte size. Single-format publications also return top-level `url`, `format`, `fileName`. All formats in one batch use one UUID and captured snapshot.

PNG/SVG `imageOptions`: `background`, `darkMode`, `embedScene`, `scale` (1/2/3), `selectedOnly`. Default selection is the whole drawing; the other options use current dialog preferences. Export uses local copies and does not change preferences, scene, active file handle or undo history. Embedded scenes are included in saved/server/clipboard image payloads; the operating system may strip PNG metadata when accepting an image clipboard item. A selected server batch uses the same exported selection for its accompanying JSON/Markdown. Image options are rejected when no image format is requested.

```json
{
  "drawingSession": "<from flow_get_context>",
  "destination": "server",
  "formats": ["png", "md"],
  "name": "My Company Flow",
  "imageOptions": { "background": false, "darkMode": false, "embedScene": true, "scale": 2 }
}
```

Server naming, storage limits and production host routing are described in `server-api-docs.md`. The manual image dialog exposes the same server batch action with all four formats, current image settings, editable export name, returned links and a copy-links button.


Export acceptance: 57 focused frontend tests, 12 Laravel tests and Playwright login/export route checks passed, as did TypeScript, export lint, build and local health. Native Browser verified server batches, manual dialog publication and public SVG rendering. PNG evidence includes transparent alpha, 2x size and embedded scene. Native Clipboard completion and local native file-dialog round-trips remain unverified in this browser; those existing IO helpers were mocked in the transport tests. The separately attempted legacy core export suite still has DOM setup/font snapshot failures. Production routing/deployment remains pending.
