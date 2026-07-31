# Sommer-Family-BBQ

Mobile Landingpage für das Familiengrillfest am 8. August 2026.

## Lokal starten

```bash
python3 -m http.server 4173 --directory sommer-family-bbq
```

Danach `http://localhost:4173` öffnen.

## Funktionsumfang

- responsives sommerlich-florales Design
- Veranstaltungsinfos und Google-Maps-Karte
- automatische Wetterprognose ab 16 Tagen vor dem Fest
- gemeinsame Supabase-Mitbringliste
- alle Besucher mit Seitenlink können Beiträge erstellen, bearbeiten und löschen
- Gästebuch im Chat-Stil: Nachrichten erstellen und löschen, aber nicht editieren

Vor dem Upload der aktuellen Frontend-Dateien muss
`supabase-open-collaboration-migration.sql` einmal im Supabase SQL Editor
ausgeführt werden.
