# Frische Codex-Chats: chronologischer Versuchsbericht

Sechs neue projektlose Chats erstellten denselben Kundengewinnungsprozess auf jeweils leerer Zeichnung. Die neue Regel ist umgesetzt: Eine Loop-Node darf auf der niedrigsten belegten Flow-Zeile bleiben; nur darüber liegende Blattknoten werden bei freiem Platz abgesenkt. Beide Rückpfeilanschlüsse liegen unten, die Rückführung darunter.

## Versuch 01 — Vorversuch, Vertrag 4

**Test:** Ein neuer Chat bekam ausschließlich URL, allgemeinen Auftrag und Screenshot-Aufgabe, ohne Vorgaben zu Labels oder Layout. **Ergebnis:** Er erzeugte zwölf Nodes mit zwei Loops und korrigierte eine abgelehnte, zu lange Pfeilbeschriftung; die beiden Loop-Ausgänge wurden zusätzlich auf y=480 abgesenkt, obwohl die übrigen Zweige auf y=240 lagen. **Einschätzung:** Grid, Wortzahl und untere Rückwege funktionierten gut, während „Webinar anmelden“, die zusätzliche Node-Zeile und die unspezifische Fehlermeldung die Qualität beziehungsweise Bedienung beeinträchtigten.

![Versuch 01](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/01-baseline/result.jpg)

## Versuch 02 — Vorversuch mit abweichendem Browser, Vertrag 4

**Test:** Ein weiterer neuer Chat erhielt denselben Auftrag mit einer neuen URL. **Ergebnis:** Nach einem Browser-Verbindungsfehler verwendete er eigenständiges Playwright/Chrome, las App-Quellcode und verkürzte einen Flow wegen „Result exceeds geometry limits“ auf zwölf Nodes mit zwei Loops. **Einschätzung:** Das fertige Diagramm hält Grid und untere Bindungen ein und schneidet keine fremden Node-Flächen, dieser Durchlauf ist wegen zusätzlichem Quellkontext und anderem Browserzugang jedoch kein sauberer Vergleich.

![Versuch 02](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/02-baseline/result.png)

[Gesicherte Zeichnung](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/02-baseline/result.excalidraw) · [Geometrieprüfung](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/02-baseline/geometry-check.json)

## Versuch 03 — Ausgangsstand mit ausdrücklich gewähltem @Browser, Vertrag 4

**Test:** Ein neuer Chat erhielt den allgemeinen Auftrag mit ausdrücklicher Auswahl des integrierten Browsers; diesen Prompt behielten alle folgenden Versuche bis auf die URL bei. **Ergebnis:** Zwölf Nodes und zwei Loops entstanden in einem erfolgreichen WebMCP-Batch ohne Flow-Toolfehler, weiterhin mit zusätzlichen Loop-Node-Zeilen und langen umgebrochenen Labels. **Einschätzung:** Die grundlegenden Regeln wurden ohne Quellcodelektüre eingehalten, aber der Rückweg zur Entscheidung teilt deren unteren Anschluss mit dem Nachfasszweig und „YouTube-Video veröffentlichen“ liest sich in der kleinen Node schlecht.

![Versuch 03](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/03-baseline-browser/result.jpg)

**Änderung nach Versuch 03:** Vertrag 5 setzt die Nutzerpräzisierung zur niedrigsten belegten Zeile um, erklärt Perspektive, Ergebnis und prüfende Entscheidungslabels, nennt die Pfeilbeschriftungsgrenzen direkt und liefert bei Überlänge den Feldpfad mit Zeichenlimit. Die private Größenprüfung unterscheidet Nodes von Pfeilen, sodass lange vorhandene Elbow-Rückwege nicht an der 2000px-Node-Grenze scheitern. Editorfunktionen und öffentliches Operationsangebot bleiben bestehen.

## Versuch 04 — Neue Höhenregel und Hilfen, Vertrag 5

**Test:** Ein frischer Chat bearbeitete denselben @Browser-Auftrag unter Vertrag 5. **Ergebnis:** Nach einer fehlenden Sitzung im Aufruf und zwei zunächst kollidierenden Abzweigungen erstellte er fünfzehn Nodes, einen abgeschlossenen Erfolgsweg und zwei Loops, deren Ausgänge auf der vorhandenen untersten Zeile y=240 bleiben. **Einschätzung:** Die neue Höhenregel und klare Trennung von Erfolgsweg und Feedback funktionieren, während lange zusammengesetzte Labels, unnötige Wiederholungen und der sehr schmale Screenshot die Bedienung beziehungsweise Lesbarkeit schwächen.

![Versuch 04, ursprüngliche Aufnahme des Chats](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/04-rules-v5/result.jpg)

Der Nutzer bestätigte den nativen Speicherdialog; die fertige Datei wurde anschließend unverändert aus Documents kopiert. Ihre fünfzehn Nodes liegen auf dem Standardgrid, beide Loop-Bindungen unten, ohne Pfeilkreuzung durch fremde Node-Flächen. Der Screenshot bleibt die ursprüngliche Aufnahme; es wurde keine nachträgliche Flow-Reparatur durchgeführt.

[Vom Nutzer gespeicherte Zeichnung](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/04-rules-v5/result.excalidraw) · [Geometrieprüfung](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/04-rules-v5/geometry-check.json)

**Änderung nach Versuch 04:** Vertrag 6 erklärt direkt in Discovery/Kontext: Erfolgsweg nach rechts anhängen, Alternative nach unten abzweigen; zwei `branch_steps` vom selben Anker beanspruchen dieselbe erste Zelle. Labels sollen einfache Wörter bevorzugen. Die optionale Loop-Hilfe empfiehlt ein Ziel mit freiem unteren Anschluss vor einer abzweigenden Entscheidung. Die Ausführungslogik entspricht Vertrag 5.

## Versuch 05 — Präzisierte Abzweigungs- und Labelhilfe, Vertrag 6

**Test:** Ein neuer Chat erhielt den unveränderten allgemeinen @Browser-Auftrag unter Vertrag 6. **Ergebnis:** Siebzehn Nodes einschließlich Start/Ende, zwei separate Nachfass-/Feedbackzweige und zwei Loops entstanden in einem erfolgreichen Batch ohne Flow-Toolfehler, mit beiden Loop-Ausgängen auf y=240. **Einschätzung:** Kürzere verständliche Labels, freier unterer Rückkehranschluss und kompakte Zeilen funktionieren gut, die Gesamtansicht ist wegen ihrer Breite bei 40 Prozent Zoom jedoch klein und Erfolgsbeschriftungen wurden über die bestehende UI ergänzt.

![Versuch 05](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/05-rules-v6/result.jpg)

## Versuch 06 — Unveränderte Wiederholung, Vertrag 6

**Test:** Ein weiterer neuer Chat wiederholte Auftrag und App-Regelstand von Versuch 05. **Ergebnis:** Nach zwei atomar abgelehnten Loop-Layouts nutzte er `insert_steps` für „Termin bestätigen“ und „Gespräch vorbereiten“, verschob damit den vorhandenen Graph und beendete den Flow mit siebzehn Nodes und beiden Loop-Ausgängen auf derselben untersten Zweigzeile. **Einschätzung:** Kurze Labels, untere Rückwege und die vorhandene Einfügefunktion bewähren sich erneut, mehrere benachbarte Zweige erfordern aber weiterhin Layoutkorrekturen und werden durch die Hilfe noch nicht zuverlässig beim ersten Versuch passend geplant.

![Versuch 06](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/06-rules-v6/result.jpg)

## Vergleichbarkeit und Messwerte

Alle sechs ersten erfolgreichen Kontextantworten belegen `total: 0`. Jeder Chat wurde mit `create_thread` projektlos neu erzeugt; keiner war ein Fork, keiner erhielt Nachhilfe oder Folgeprompts. Alle liefen mit den tatsächlich protokollierten Defaults **gpt-6.1-sol / high**. Die App blieb während jedes Durchlaufs unverändert. Prompts enthalten keine Label-, Grid-, Port- oder Tool-Aufrufregeln; die Agents erhielten diese aus Discovery, Kontext und optionaler Hilfe.

Gemeinsame Systemanweisungen, Browser-Skills und allgemeines Modellwissen bleiben vorhanden. Die Erstellungsnachricht nennt die ID des Elternchats, übernimmt aber dessen Gespräch nicht; in den protokollierten Aufrufen wurde kein Elternchat gelesen. Versuch 02 wird wegen der App-Quellcodelektüre ausgeschlossen. Ab 03 ist der Prompt gleich; 04 enthält einen Nutzereingriff ausschließlich beim Speichern. Browserinitialisierung, UI-Schritte, Screenshot-Auflösung und Zoom waren nicht vollständig kontrolliert. Daher wird **keine kausale Laufzeitverbesserung** behauptet.

| Versuch | Vertrag | Nodes | Zweiwortlabels\* | Erfolgreiche Batches | Beobachtete Flow-Fehler | Gesamtdauer |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 4 | 12 | 12/12 | 2 | 1: Pfeillabel zu lang | 1:50 |
| 02 | 4 | 12 | 12/12 | Endgraph belegt; Zählung unvollständig | 1: Pfeilspannweite | 4:52 |
| 03 | 4 | 12 | 12/12 | 1 | 0 | 1:33 |
| 04 | 5 | 15 | 13/13 | 1 | 2: Sitzung fehlt / Zelle belegt | 4:28 |
| 05 | 6 | 17 | 15/15 | 1 | 0 | 2:02 |
| 06 | 6 | 17 | 15/15 | 3 | 2: kein freier Loop-Korridor | 2:42 |

\*Start/Ende sind erlaubte Ausnahmen. Wortzahl ist kein Nachweis grammatischer oder inhaltlicher Qualität. Die Dauern umfassen Skill-Lektüre, Browserstart, Hilfe, Erstellung, UI-Nacharbeit, Speichern und Screenshot. Ein Teil der Browserinitialisierung scheiterte an der vertrauensgebundenen Browser-Bridge; dies ist kein Fehler des App-Katalogs. Versuch 02 hat unvollständig extrahierte Antwortdaten, sein Endgraph ist zusätzlich durch Datei und Screenshot belegt.

Die Zeichnungsdateien von 02/04 erlauben vollständige unabhängige geometrische Prüfungen; sonst beruhen Aussagen auf zurückgegebenen Commit-Daten und sichtbaren Screenshots. Ein paginierter Kontext mit nur einem Element gilt ausdrücklich nicht als vollständige Endgeometrie. Pfeiltexte, gemeinsame Endpunkte und alle gegenseitigen Pfeilkreuzungen werden durch die Rechteckprüfung nicht vollständig bewertet.

## Ausgelieferter Stand und Grenzen

Die gemeinsamen Regeln liegen in `excalidraw-app/webmcp/schema.ts`, ihre Discovery in `register.ts`, die Höhen-/Korridorwahl in `loopRouting.ts`. Eingabe- und Geometrieprüfungen liegen in `engineSchema.ts` und `operations.ts`. Drei öffentliche Tools und acht bestehende Operationen bleiben unverändert; angepasst wurden Hilfen und Wrapper um vorhandene Editorfunktionen.

Die Höhenregel ist funktional durch einen flachen Elf-Node-Flow mit 2400px-Rückpfeil geprüft: Alle Nodes bleiben auf y=0. Eine darüber liegende Loop-Node wird zusätzlich im Hindernis-/Undo-/Idempotenztest auf die bereits vorhandene niedrigste Zeile gesetzt. Die fokussierte Suite bestand mit **48 Tests**; nach der abschließenden reinen Hilfeänderung bestanden nochmals alle fünf Katalogtests innerhalb der bisherigen Größenbudgets. App-Typecheck, WebMCP-Lint, App-Build, HTTP 200/Listener und die neuen nativen Browser-Ergebnisse sind verifiziert. Bestehende React-act- und Bundler-Warnungen bleiben.

Mehrere sich gegenseitig blockierende Zweige bleiben eine Grenze der begrenzten Wrapper-Platzierung. Versuch 06 zeigt eine funktionierende Reparatur über die vorhandene Einfügefunktion; eine garantierte automatische globale Neuordnung ist nicht implementiert. Inhalt und Wortarten bleiben Agentenaufgaben, während Wortzahl, Standardgeometrie, ungültige Batches und Node-Kreuzungen geprüft werden.

Der Computer-Use-Zugriff auf native Codex-Dialoge wurde trotz Nutzerautorisierung aus Sicherheitsgründen abgewiesen. Unterstützte Browser-Importwege erzeugten keine Kopie; der leere Beobachtungstab wurde geschlossen. Die vom Nutzer gespeicherte Originaldatei und alle sechs ursprünglichen Ergebnisaufnahmen sind erhalten.

Protokoll: [protocol.md](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/protocol.md). Je Versuchsordner: genauer Prompt, Thread-ID, Quellstand, Aufrufe, Antworten, Zusammenfassung und Screenshot; Threadliste: [threads.json](/Users/oliver/Herd/excaliflow/experiments/fresh-sessions-2026-10-01/threads.json). Bericht, Screenshots und Quellstände sind im Repository gesichert; rohe Chatnachrichten, Aufrufe und Antworten bleiben lokal.
