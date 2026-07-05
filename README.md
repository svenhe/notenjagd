# 🎼 Notenjagd – Notenlernspiel

Ein lokales Lernspiel: Eine Note erscheint im Violin- oder Bassschlüssel –
singe oder spiele den Ton (Mikrofon), oder tippe ihn auf der Bildschirm-Klaviatur.
Richtig = +1 Punkt und die nächste Note erscheint. Falsch = −1 Punkt, die Note bleibt.
Ziel: möglichst viele Punkte, bevor die Zeit abläuft. Rekorde werden pro
Einstellungs-Kombination gespeichert.

## Starten

**Am PC:** `Notenlernspiel.html` doppelklicken (oder mit Chrome öffnen).
Beim ersten Spielstart den Mikrofon-Zugriff erlauben.

**Auf Android-Handy/-Tablet:**
1. Die eine Datei `Notenlernspiel.html` aufs Gerät kopieren
   (USB-Kabel, E-Mail an sich selbst, Cloud-Speicher …), z. B. in den Ordner *Download*.
2. In Chrome öffnen: entweder über den Dateimanager → „Öffnen mit → Chrome“,
   oder in der Adresszeile eingeben: `file:///sdcard/Download/Notenlernspiel.html`
3. Mikrofon-Zugriff erlauben. Fertig – funktioniert komplett offline.

Falls das Mikrofon auf einem Gerät nicht freigegeben wird: Eingabe **„Tasten“**
wählen – dann läuft das Spiel ohne Mikrofon mit der Bildschirm-Klaviatur.

## Einstellungen

| Option | Bedeutung |
|---|---|
| Notenschlüssel | Violinschlüssel, Bassschlüssel oder beide gemischt |
| Tonart | alle Dur-Tonarten bis 6 ♯ / 6 ♭; gewürfelt werden nur leitereigene Töne, Vorzeichen stehen als Generalvorzeichen am Systemanfang |
| Tonumfang | ohne Hilfslinien / 1 Hilfslinie / 2 Hilfslinien (pro Schlüssel) |
| Spieldauer | 30 s bis 5 min |
| Eingabe | Mikrofon (Gesang oder Instrument), Bildschirm-Tasten oder beides |
| Empfindlichkeit | wie laut es sein muss, damit ein Ton zählt (bei Störgeräuschen „Niedrig“ wählen) |
| Ton auch vorspielen | die gesuchte Note wird zusätzlich vorgespielt (🔊-Knopf zum Wiederholen) |
| Oktave muss stimmen | aus = nur der Notenname muss stimmen (gut für Gesang), an = exakte Oktave nötig (gut fürs Klavier). Bei „an“ wird die Bildschirm-Klaviatur automatisch lang (über den ganzen Notenbereich des Schlüssels), mit beschrifteten C-Tasten und farblich markiertem c′ (mittlerem C) |
| Stimmung (Kammerton a′) | Standard 440 Hz. Für anders gestimmte Instrumente: a′ direkt eingeben (392–466 Hz) oder **🎹 C einspielen** drücken und ein beliebiges C spielen/singen – die App misst die Abweichung selbst (funktioniert auch bei einen Halbton tiefer gestimmten Klavieren). Wirkt auf Erkennung **und** Vorspielen |

## Tipps

- Ein Ton gilt als getroffen, wenn er näher als ein halber Halbton (±50 Cent)
  am Sollton liegt und ca. 0,1 s stabil klingt. Leicht verstimmte Klaviere
  (438–442 Hz) sind damit automatisch abgedeckt; für stärker oder anders
  gestimmte Instrumente die Stimmungs-Kalibrierung benutzen.
- Während App-Töne abgespielt werden, pausiert die Erkennung kurz – das
  verhindert, dass das Spiel sein eigenes Feedback „hört“.
- Ein gehaltener falscher Ton kostet nur **einen** Punkt. Erst nach einer kurzen
  Pause (oder einem anderen Ton) wird neu bewertet.
- Die Anzeige unten zeigt live, welchen Ton das Mikrofon hört, wie sauber er
  getroffen ist (Zeiger) und wie laut es ist (Balken).
- Klaviertöne können von der Erkennung gelegentlich um eine Oktave verrutschen –
  dafür gibt es die Standardeinstellung „Oktave egal“.
- Wechselt man während des Spiels die App, pausiert das Spiel automatisch.

## Entwicklung

- `index.html` + `style.css` + `js/*.js` – der Quellcode in Einzeldateien
  (VexFlow 4.2.2 liegt lokal in `js/vexflow.js`, keine Internetverbindung nötig).
- `build.ps1` – baut alles in die eine Datei `Notenlernspiel.html`:
  `powershell -ExecutionPolicy Bypass -File build.ps1`
- `devserver.py` – Mini-Testserver ohne Caching: `python devserver.py`
  → http://127.0.0.1:8317
- Testmodus: URL-Parameter `?mictest=1` ersetzt das Mikrofon durch einen
  synthetischen Ton (`App.setTestFreq(440)` in der Konsole); `App.runSelfTests()`
  führt die eingebauten Selbsttests aus.

## Ideen für Schritt 2

- Notensequenzen statt Einzeltönen (kleine Melodien nachspielen)
- MIDI-Dateien laden und als Übung abspielen lassen
- Moll-Tonarten, chromatische Töne, einstellbarer Kammerton
- Statistik, welche Noten am häufigsten danebengehen
