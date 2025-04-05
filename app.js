// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene;

// Variable für das Reticle-Mesh deklarieren (außerhalb der Funktion, damit sie bestehen bleibt)
let defaultObject = null;

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


// Funktion zur Erstellung des Reticles (Zielkreuz/Platzierungsanzeige)
function createReticle() {
    // Nur erstellen, wenn es noch nicht existiert
    if (!defaultObject) {
        defaultObject = BABYLON.MeshBuilder.CreateBox("standardBox", { width: 1, height: 0.5, depth: 0.3, updatable: true }, scene); // Angepasste Größe
        let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
        reticleMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1); // Hellblau/Lila
        reticleMat.roughness = 1; // Matt
        reticleMat.disableLighting = true; // Unbeeinflusst von Licht
        reticleMat.backFaceCulling = false; // Rückseite sichtbar machen

        // Korrigiert: Das erstellte Material 'reticleMat' verwenden
        defaultObject.material = reticleMat;
        defaultObject.renderingGroupId = 1; // Über anderen Objekten rendern (falls nötig)
        defaultObject.isVisible = false; // Standardmäßig unsichtbar
        defaultObject.isPickable = false; // Nicht anklickbar machen

        // Sicherstellen, dass ein Quaternion für die Rotation vorhanden ist
        if (!defaultObject.rotationQuaternion) {
                defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
        }
            // Skalierung bleibt Standard (1, 1, 1) durch MeshBuilder
    }
}



// Asynchrone Funktion zur Erstellung der Szene
const createScene = async function () {
    // Zuerst die BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine); // Annahme: 'engine' wurde vorher initialisiert

    // Kamera erstellen -> FreeCamera für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1; // Setzt die Layer-Maske der Kamera
    // Kamera an das Canvas binden, um Eingaben zu verarbeiten
    camera.attachControl(canvas, true);

    // Lichtquelle erstellen -> HemisphericLight für gleichmäßige Umgebungsbeleuchtung
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1000, 5), scene);
    light.intensity = 0.2; // Intensität des Lichts

    // Lichtquelle erstellen -> PointLight für eine punktuelle Lichtquelle
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 1000, 5), scene);
    light2.intensity = 0.1; // Intensität des Lichts

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Elemente erstellen
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");

    const startUI_bg = new BABYLON.GUI.Rectangle("rect");
    startUI_bg.background = "black"; // Hintergrundfarbe
    startUI_bg.color = "green"; // Randfarbe
    startUI_bg.width = "80%"; // Breite
    startUI_bg.height = "50%"; // Höhe
    startUI_bg.isPointerBlocker = true; // Verhindert, dass Klicks durch das GUI Element gehen
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel(); // Panel für Inhalte, wenn kein XR verfügbar ist
    startUI_bg.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica"; // Schriftart
    text1.textWrapping = true; // Erlaubt Zeilenumbruch
    text1.color = "white"; // Textfarbe
    text1.fontSize = "14px"; // Schriftgröße
    text1.height = "400px"; // Feste Höhe (könnte Anpassung erfordern)
    text1.paddingLeft = "10px"; // Linker Innenabstand
    text1.paddingRight = "10px"; // Rechter Innenabstand





    // Text basierend auf AR-Verfügbarkeit setzen
    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please use a supported device (e.g., Meta Quest 3 or modern Android) and browser (e.g., Chrome).";
        nonXRPanel.addControl(text1);
        // Wichtig: Szene zurückgeben, auch wenn AR nicht verfügbar ist
        return scene;
    } else {
        text1.text = "Willkommen. Möbel-Simulator 0.1 by Tom";
        nonXRPanel.addControl(text1);
    }





    // XR Experience Helper erstellen
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar", // Startet die AR-Session im immersiven Modus
            referenceSpaceType: "local-floor", // Benutzt den Boden als Referenz für AR-Objekte
            onError: (error) => {
                console.error("XR Session Error:", error); // Fehler in der Konsole ausgeben
                alert(error); // Einfache Fehlermeldung für den Benutzer
            }
        },
        optionalFeatures: true // Optionale Features aktivieren, falls verfügbar
    });

    // Hide Start GUI in XR
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => { // TODO
        startUI_bg.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        startUI_bg.isVisible = true;
    });



    // Überprüfen, ob XR erfolgreich initialisiert wurde
    if (!xr.baseExperience) {
        console.error("XR Base Experience konnte nicht initialisiert werden.");
        text1.text = "Error initializing XR. Please check console for details.";
        return scene; // Szene trotzdem zurückgeben
    }

    const fm = xr.baseExperience.featuresManager;

    // Hit-Test-Feature aktivieren (falls verfügbar)
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    if (!xrTest) {
        console.warn("WebXR Hit Test Feature ist nicht verfügbar.");
    }

    // Zugriff auf die XR-Kamera (wenn vorhanden)
    const xrCamera = xr.baseExperience.camera;

    // Variablen für Hit-Test-Ergebnisse deklarieren
    let hitTest = undefined;
    let hitTestPosition = new BABYLON.Vector3(); // Deklariert und initialisiert
    let hitTestRotation = new BABYLON.Quaternion(); // Deklariert und initialisiert



    // Observable für Hit-Test-Ergebnisse hinzufügen (nur wenn xrTest verfügbar ist)
    if (xrTest) {
        xrTest.onHitTestResultObservable.add((results) => {
            if (results.length) {
                hitTest = results[0];
                // Position und Rotation aus der Transformationsmatrix extrahieren
                hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);
                // Optional: Hier Logik einfügen, um das Reticle zu positionieren/zeigen
                if (defaultObject) {
                    defaultObject.isVisible = true;
                    defaultObject.position.copyFrom(hitTestPosition);
                    defaultObject.rotationQuaternion = hitTestRotation;
                }
            } else {
                hitTest = undefined;
                // Optional: Hier Logik einfügen, um das Reticle auszublenden
                if (defaultObject) {
                    defaultObject.isVisible = false;
                }
            }
        });
    }



    // Reticle erstellen (die Funktion wird hier definiert, aber noch nicht aufgerufen)
    createReticle();

    // Wichtig: Die erstellte Szene zurückgeben
    return scene;
};

// Event Listener für die Größenänderung des Fensters
window.addEventListener("resize", function () {
    // Sicherstellen, dass die Engine existiert, bevor resize aufgerufen wird
    if (engine) {
        engine.resize(); // Passt die Engine an die neue Fenstergröße an
    }
});


//Szene starten
async function initializeApp() {
    try {
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine could not be created');
        scene = await createScene();
        if (!scene) throw new Error('Scene could not be created');
        sceneToRender = scene;
        startRenderLoop(engine, canvas);
    } catch (e) {
        console.error("Initialization failed:", e);
        // Hier könnte eine Fehlermeldung im UI angezeigt werden
    }
}


// App starten, wenn das DOM geladen ist
document.addEventListener("DOMContentLoaded", initializeApp);



