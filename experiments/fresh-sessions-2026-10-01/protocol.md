# Frische Codex-Sessions: Flow-Erstellung

## Fester Auftrag

> Öffne http://localhost:3001/?experiment=NN im Browser und erstelle dort mit WebMCP einen beispielhaften Flow zur Kundengewinnung: Über YouTube kommen Interessenten auf eine Landingpage, melden sich zu einem Webinar an und werden danach zu einem Beratungsgespräch eingeladen. Nimm auch auf, was mit Interessenten passiert, die noch keinen Termin buchen, und wie Erkenntnisse aus den Gesprächen wieder zu neuen Videos führen. Speichere einen Screenshot des fertigen Flows.

Vorversuche 01/02 nutzten diesen Auftrag. Ab Versuch 03 wird nur der Einstieg präzisiert: `Nutze [@Browser](plugin://browser@openai-bundled/) und öffne http://localhost:3001/?experiment=NN. Erstelle dort ...`. Ab 03 variiert nur `NN`. Der Prompt enthält keine Vorgaben zu Labels, Grid, Formen, Operationen, Pfeilanschlüssen, Reihenfolge der Toolaufrufe oder Loop-Layout und keinen Hinweis auf frühere Ergebnisse.

## Kontrollierte Bedingungen

- Jeder Versuch bekommt einen neu erstellten **projektlosen Codex-Chat**, ohne Fork und ohne vorangegangene Turns. Kein Repository-Projekt: dessen AGENTS.md wird nicht als Projektkontext mitgegeben.
- Modell und Reasoning werden nicht überschrieben; alle Versuche nutzen die konfigurierten Defaults. Tatsächlich sichtbare Einstellungen werden mit der Versuchsevidenz erfasst.
- Jeder Versuch verwendet einen neuen Browser-Dokumentaufruf mit einer eindeutigen URL. Unbekannte Query-Parameter verändern das App-Verhalten nicht; lokale Szenepersistenz ist standardmäßig deaktiviert.
- Leerstart muss durch den ersten erfolgreichen `flow_get_context`-Aufruf (`total: 0`) belegt sein. Ohne diesen Nachweis zählt ein Durchlauf nicht als kontrollierter Qualitätsvergleich.
- Agenten bekommen keine Nachhilfe oder Ergebnisbesprechung. Folgetests verwenden stets neue Chats. Übergreifende Plattformanweisungen, Skills und allgemeines Modellwissen bleiben vorhanden; vollständige Kontextfreiheit auf Systemebene wird nicht behauptet.
- Versuche laufen nacheinander. Keine Änderungen der App während eines laufenden Versuchs. Vorher werden Versionsstand und relevante Quellen gesichert; danach Ergebnis und Screenshot.
- Bevor Regeln geändert werden, wird der Ausgangsstand nach Möglichkeit zweimal getestet. Der geänderte Stand wird ebenfalls mit frischen Chats wiederholt.
- Infrastrukturfehler werden getrennt ausgewiesen und zählen nicht als Nachweis schlechter Flow-Regeln. Keine manuelle Reparatur eines Agentenergebnisses vor dessen Auswertung/Screenshot.

## Auswertung

1. Inhalt: YouTube → Landingpage → Webinar-Anmeldung/Webinar → Einladung/Buchung/Beratung; erreichbarer Nachfasspfad und Rückkopplung der Gesprächserkenntnisse zu Videos.
2. Labels: überwiegend zwei kurze Wörter aus Nomen + Verb, Ausnahmen Start/Ende; Bedeutung wird menschlich beurteilt, Wortzahl zusätzlich gezählt.
3. Layout: 120×120 Nodes, 120px-Grid, chronologische Hauptfolge nach rechts, Vorwärtspitch 240px und erkennbare Abzweigungen.
4. Loops: unterer Ausgang und unterer Eingang; Ausgang auf der niedrigsten belegten Zeile genügt (Nutzerpräzisierung während Versuch 03, umgesetzt erst nach dessen Ende); getrennte Rückwege und vermeidbare Kreuzungen.
5. Überschneidungen: Node-Node, Pfeil-Node sowie Pfeil-Pfeil getrennt; geometrische Checks ergänzen die gerenderte Ansicht.
6. Nutzung: Discovery/Help/Schreibaufrufe, Fehler und Wiederholungen, Dauer; Repository-/Dateikontext und Eingriffe des Beobachters dokumentieren.

## Ablage und Bericht

Je Versuch: Prompt, Thread-ID/Status, Quellstand, Tool-/Turn-Evidenz, Ergebnisdaten, Screenshot und Auswertung. Der Abschlussbericht folgt chronologisch: **ein Satz Test**, **Ergebnis**, **ein Satz Einschätzung mit Gut/Schlecht**, anschließend Screenshot und der nächste Versuch. Unterschiede der Hilfen und Auswertungsgrenzen werden konkret ausgewiesen; kleine Stichproben werden nicht als statistischer Wirksamkeitsnachweis dargestellt.

Vorversuch 02 ist wegen abweichendem Playwright-Zugang und Quellcodelektüre kein kontrollierter Vergleich. Versuche 03–06 haben denselben @Browser-Auftrag. Vertrag 4: 03; Vertrag 5: 04; Vertrag 6: 05/06. Die App bleibt jeweils bis zum Testende unverändert. Alle bleiben projektlose neue Chats ohne Nachhilfe.

Darstellung und Dauer sind nur eingeschränkt vergleichbar: Browserinitialisierung und nachfolgende UI-/Speicherschritte variieren, Versuch 04 hat einen schmalen Screenshot. Der Nutzer bestätigte dort den nativen Dateidialog; keine Hilfe zur Flow-Erstellung wurde erteilt. Die fertig gespeicherte Zeichnung wurde danach als zusätzliche Evidenz kopiert.
