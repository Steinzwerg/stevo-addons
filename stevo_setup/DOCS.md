# STEVO Einrichtung

## Du hast schon Home Assistant (Selbst-Einrichtung)
1. Add-on starten und „Benutzeroberfläche öffnen“.
2. Auf **Mit STEVO-Konto verbinden** klicken, anmelden und auswählen, was eingerichtet werden soll:
   Startseite behalten oder STEVO Home, Seitenleiste, Backups jetzt oder später, Fernzugriff, Matter.
3. Der Assistent richtet nur das Gewählte ein und startet Home Assistant einmal neu.
   Dein Benutzer, dein Passwort, deine Geräte, Automationen und Dashboards bleiben unverändert.
   Was du übersprungen hast, holst du später in Home Assistant unter **Service** nach.

Voraussetzung: Home Assistant OS (z. B. Raspberry Pi 4/5, Home Assistant Green) und ein STEVO-Abo.

## Neuer Pi aus der STEVO-Werkstatt
Der STEVO Installer bespielt die SSD, führt durch das Einrichtungskonto und öffnet dieses Add-on.
Er ordnet den Pi automatisch dem Kunden zu (ohne Installer: Code im Team-Panel unter **Neuer Pi** eintragen).
Danach richtet sich der Pi selbst ein: Region, Add-ons, Fernzugriff, STEVO-Paket, Neustart, Kopplung,
und das Einrichtungskonto geht mit neuem Passwort an den Kunden.

Der Pi spricht nur mit der STEVO-Website. Nach der Einrichtung stoppt sich das Add-on selbst und kann deinstalliert werden.
