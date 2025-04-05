// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene; // Globale Szene-Variable, wird in initializeApp gesetzt

// Funktion zum Starten der Render-Schleife
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        // Sicherstellen, dass die Szene existiert und eine aktive Kamera hat
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

// Funktion zur Erstellung der BabylonJS-Engine mit spezifischen Einstellungen
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true, // Erhält den Zeichenpuffer
        stencil: true, // Aktiviert den Stencil-Puffer für Effekte
        disableWebGL2Support: false // WebGL2-Unterstützung aktivieren (falls verfügbar)
    });
};

// Asynchrone Funktion zur Erstellung der Szene
const createScene = async function () {
    // Zuerst die lokale BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine); // 'engine' muss vorher initialisiert sein

    // === Lokale Variablen für diese Szene ===
    let defaultObject = null; // Das Reticle/Platzierungsobjekt
    let firstObject = null; // Das erste platzierte Objekt (könnte zu einer Liste werden)
    let hitTest = undefined;
    let hitTestPosition = new BABYLON.Vector3();
    let hitTestRotation = new BABYLON.Quaternion();
    let xr = null; // Wird später initialisiert
    // =======================================

    // Kamera erstellen -> FreeCamera für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1; // Setzt die Layer-Maske der Kamera
    camera.attachControl(canvas, true); // Kamera an das Canvas binden

    // Lichtquellen erstellen
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene); // Position angepasst
    light.intensity = 0.7; // Intensität angepasst
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene); // Position angepasst
    light2.intensity = 0.5; // Intensität angepasst

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Elemente erstellen
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI"); // Name geändert
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect"); // Name geändert
    startUI_bg.background = "black";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.isPointerBlocker = true;
    startUI_bg.isVisible = true; // Explizit sichtbar machen am Anfang
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel"); // Name geändert
    startUI_bg.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "400px"; // Potenziell zu groß, ggf. anpassen oder auf auto setzen
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";
    nonXRPanel.addControl(text1); // Text zum Panel hinzufügen

    // Funktion zur Erstellung des Standard-Objekts (Reticle), jetzt *innerhalb* von createScene
    function createStandardObj() {
        if (!defaultObject) {
            // Verwende die *lokale* 'scene' Variable
            defaultObject = BABYLON.MeshBuilder.CreateBox("standardBox", { width: 0.2, height: 0.1, depth: 0.05, updatable: true }, scene); // Größe angepasst
            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1);
            reticleMat.roughness = 1;
            reticleMat.disableLighting = true; // Oft sinnvoll für Reticles
            reticleMat.backFaceCulling = false;

            defaultObject.material = reticleMat;
            defaultObject.renderingGroupId = 1;
            defaultObject.isVisible = false; // Unsichtbar bis erster Hit-Test
            defaultObject.isPickable = false;

            if (!defaultObject.rotationQuaternion) {
                defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
            }
        }
    }

    // Funktion zur Manipulation des platzierten Objekts, jetzt *innerhalb* von createScene
    function manipulateObject(obj) {
        if (obj && obj.scaling) { // Prüfen ob obj und scaling existieren
             // Korrigiert: Verwende die 'scaling' Eigenschaft
             // Annahme: Originalgröße war die des Reticles (0.2, 0.1, 0.05)
             // Skaliere es z.B. auf das 10-fache
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt übergeben:", obj);
        }
    }

    // Text basierend auf AR-Verfügbarkeit setzen
    if (!arAvailable) {
        text1.text = "AR is not available in your system...";
        return scene; // Szene zurückgeben
    } else {
        text1.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Tippe auf den Bildschirm, um ein Objekt zu platzieren.";
    }

    // XR Experience Helper erstellen
    // Weise das Ergebnis der lokalen Variable 'xr' zu
    xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => {
                console.error("XR Session Error:", error);
                alert("XR Error: " + error.message); // Bessere Fehlermeldung
            }
        },
        optionalFeatures: true
    });

    // Überprüfen, ob XR erfolgreich initialisiert wurde
    if (!xr || !xr.baseExperience) {
        console.error("XR Base Experience konnte nicht initialisiert werden.");
        text1.text = "Error initializing XR. Please check console.";
        return scene; // Szene trotzdem zurückgeben
    }

    // Hide Start GUI in XR
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        startUI_bg.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        startUI_bg.isVisible = true;
    });

    const fm = xr.baseExperience.featuresManager;

    // Hit-Test-Feature aktivieren (falls verfügbar)
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    if (!xrTest) {
        console.warn("WebXR Hit Test Feature ist nicht verfügbar.");
        text1.text = "Hit-Test Feature nicht verfügbar. Platzierung nicht möglich.";
    } else {
        // Observable für Hit-Test-Ergebnisse hinzufügen
        xrTest.onHitTestResultObservable.add((results) => {
            if (results.length) {
                hitTest = results[0]; // Lokale Variable aktualisieren
                hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);

                if (defaultObject) { // Prüfen ob Reticle existiert
                    defaultObject.isVisible = true;
                    defaultObject.position.copyFrom(hitTestPosition);
                    if (defaultObject.rotationQuaternion) { // Sicherstellen, dass Quaternion existiert
                         defaultObject.rotationQuaternion.copyFrom(hitTestRotation);
                    }
                }
            } else {
                hitTest = undefined; // Lokale Variable aktualisieren
                if (defaultObject) {
                    defaultObject.isVisible = false;
                }
            }
        });
    }

    // === Pointer Down Handler jetzt *innerhalb* von createScene ===
    scene.onPointerDown = (evt, pickInfo) => {
        // Prüfen ob wir in XR sind und ein gültiger Hit-Test vorliegt
        // Verwende die *lokale* Variable 'xr' und 'hitTest'
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest && defaultObject) {

             // Klon erstellen vom *Reticle* (defaultObject)
             // Weist das Ergebnis der *lokalen* Variable 'firstObject' zu
             firstObject = defaultObject.clone("placedObject_" + Date.now()); // Eindeutiger Name

             if (firstObject) {
                 // Position und Rotation vom aktuellen Hit-Test übernehmen
                 firstObject.position.copyFrom(hitTestPosition);
                 if (firstObject.rotationQuaternion) {
                     firstObject.rotationQuaternion.copyFrom(hitTestRotation);
                 }

                 // Sichtbar und ggf. pickable machen
                 firstObject.isVisible = true;
                 firstObject.isPickable = true; // Erlaube Interaktion mit platziertem Objekt

                 // Platziertes Objekt manipulieren (z.B. Größe ändern)
                 manipulateObject(firstObject);

                 // Optional: Nachricht oder Feedback geben
                 console.log("Objekt platziert an:", firstObject.position);

                 // Das Reticle (defaultObject) wird NICHT entfernt,
                 // damit weitere Objekte platziert werden können.
                 // defaultObject = null; // DIESE ZEILE WURDE ENTFERNT/AUSKOMMENTIERT

                 // Hit-Test zurücksetzen, um Doppelplatzierung bei schnellem Klick zu vermeiden?
                 // hitTest = undefined; // Optional, je nach gewünschtem Verhalten
                 // if (defaultObject) defaultObject.isVisible = false; // Optional Reticle kurz ausblenden

             } else {
                 console.error("Klonen des Objekts fehlgeschlagen.");
             }
        }
        // Hier könnte Logik für Klicks außerhalb von XR oder auf GUI-Elemente stehen
        // console.log("Pointer Down Event:", evt, pickInfo);
    };
    // ============================================================

    // Reticle initial erstellen (ruft die lokale Funktion auf)
    createStandardObj();

    // Wichtig: Die erstellte *lokale* Szene zurückgeben
    return scene;
};

// Event Listener für die Größenänderung des Fensters
window.addEventListener("resize", function () {
    if (engine) {
        engine.resize();
    }
});

// Szene starten
async function initializeApp() {
    try {
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine could not be created');

        // Rufe createScene auf und weise das Ergebnis der *globalen* scene Variable zu
        // und auch sceneToRender
        scene = await createScene();
        if (!scene) throw new Error('Scene could not be created');
        sceneToRender = scene;

        // Starte die Render-Schleife *nachdem* alles initialisiert ist
        startRenderLoop(engine, canvas);

    } catch (e) {
        console.error("Initialization failed:", e);
        // Zeige Fehler im UI an
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.padding = '10px';
        errorDiv.style.backgroundColor = 'red';
        errorDiv.style.color = 'white';
        errorDiv.textContent = 'Initialization Failed: ' + e.message;
        document.body.appendChild(errorDiv);
    }
}

// App starten, wenn das DOM geladen ist
document.addEventListener("DOMContentLoaded", initializeApp);