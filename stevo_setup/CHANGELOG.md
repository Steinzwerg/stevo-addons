## 1.2.1
- Reverse-Proxy: http/config/configure bekommt jetzt das richtige Format ({ config: { … } } mit den aktiven Einstellungen), dazu Bestätigung, falls Home Assistant die Änderung erst vorläufig übernimmt.

## 1.2.0
- Ab Home Assistant 2026.8: Reverse-Proxy (Cloudflare-Tunnel) wird in den Einstellungen gesetzt (http/config/configure) statt in configuration.yaml, sonst antwortet der Fernzugriff mit 400.
- Prüfschritt sagt genauer, warum der Fernzugriff noch nicht geht (400 / 502).

## 1.1.2
- Meldet den Port von Home Assistant an die Website (ab HA 2026.8 bei Neuinstallationen 80 statt 8123), damit der Fernzugriff auf den richtigen Port zeigt.

## 1.1.1
- Baut wieder auf neueren Home Assistant (Supervisor setzt BUILD_FROM nicht mehr): eigenes Basis-Image alpine:3.21.

## 1.1.0
- Das beim Einrichten angelegte Konto wird automatisch an den Kunden übergeben (Name, Benutzername, neues Passwort, alte Anmeldungen beendet). Braucht STEVO 1.15.0.

## 1.0.0
- Erste Version: Code anzeigen, Plan von der Website holen, Pi komplett einrichten.
