## 1.4.2
- Zigbee-Stick wird automatisch erkannt (ZBT-2, ZBT-1, Sonoff Dongle-E/-P, ConBee, SLZB), in Zigbee2MQTT eingetragen und Zigbee2MQTT gestartet. Der Stick muss beim Einrichten stecken.

## 1.4.1
- Selbst-Einrichtung: Wahl „Seitenleiste aufräumen“ wird an Home Assistant weitergegeben (STEVO 1.29.6 blendet dann alte Dashboards, Verlauf und Aktivität aus). Bei der Einrichtung durchs Team ist Aufräumen Standard.

## 1.4.0
- Werkstatt: Am Ende wird aufgeräumt. Geräte, die Home Assistant im Werkstatt-Netz gefunden hat („Entdeckt“), werden verworfen, technische Werte von Supervisor, Raspberry Pi, Netzteil und Backup im Verlauf ausgeblendet (laufen weiter). Updates bleiben sichtbar. Bei der Selbst-Einrichtung im eigenen Home Assistant wird nichts angefasst.

## 1.3.0
- Selbst-Einrichtung für Kunden mit eigenem Home Assistant: Das Add-on erkennt ein schon benutztes System (mehrere Benutzer, Automationen oder viele Geräte) und zeigt „Mit STEVO-Konto verbinden“. Der Kunde wählt auf der Website, was eingerichtet wird (Startseite, Seitenleiste, Backups, Fernzugriff, Matter).
- Im Selbst-Modus: keine Region, keine Werkstatt-Vorlage, keine Konto-Übergabe. Benutzer und Passwort des Kunden bleiben unverändert.
- Sicherheit für die Werkstatt: Wirkt ein Home Assistant schon benutzt, wird auch dort kein Konto übernommen.
- Neu koppeln: Eine alte STEVO-Kopplung wird vorher entfernt (der Plan bringt immer einen neuen Kopplungscode).
- Werkstatt-Ablauf mit Installer bleibt unverändert.

## 1.2.3
- Matter Server wird mit „ble_proxy“ eingerichtet: Home Assistant koppelt Matter-Geräte über das eingebaute Bluetooth des Pi, ohne Funk-Stick und ohne Handy-App.

## 1.2.2
- Reverse-Proxy-Einstellung wird nach dem Neustart mit http/config/promote bestätigt. Kein Bestätigen im Browser mehr nötig, kein Zurücksetzen nach 5 Minuten.

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
