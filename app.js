// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene; // Globale Szene-Variable, wird in initializeApp gesetzt

let mode = 0; // 0 = CREATE, 1 = MANIPULATE

// Funktion zum Starten der Render-Schleife
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

// Funktion zur Erstellung der BabylonJS-Engine mit spezifischen Einstellungen
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false
    });
};

// Asynchrone Funktion zur Erstellung der Szene
const createScene = async function () {
    // Zuerst die lokale BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine);

    // === Lokale Variablen für diese Szene ===
    let defaultObject = null; // Das Reticle/Platzierungsobjekt
    let firstObject = null; // Das erste platzierte Objekt
    let hitTest = undefined;
    let hitTestPosition = new BABYLON.Vector3();
    let hitTestRotation = new BABYLON.Quaternion();
    let xr = null; // Wird später initialisiert
    let fertigButton = null;
    let initialText = null;
    let xrInstructionText = null;
    let advancedTexture = null; // *** WIRD SPÄTER INITIALISIERT ***
    // =======================================

    console.log("createScene: Start");

    // Kamera erstellen
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1;
    camera.attachControl(canvas, true);

    // Lichtquellen erstellen
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene);
    light.intensity = 1.7;
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene);
    light2.intensity = 1.5;
    var testLight = new BABYLON.HemisphericLight("testLight", new BABYLON.Vector3(0, 1, 0), scene);
    testLight.intensity = 3;

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    console.log("createScene: AR Available =", arAvailable);

    // *** GUI Elemente werden deklariert, ABER ERST NACH XR-INIT ZUR TEXTUR HINZUGEFÜGT ***

    // --- Start-Panel ---
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "rgba(0,0,0,0.7)";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.cornerRadius = 20;
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true; // Bleibt initial sichtbar

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel);

    initialText = new BABYLON.GUI.TextBlock("initialText");
    initialText.fontFamily = "Helvetica";
    initialText.textWrapping = true;
    initialText.color = "white";
    initialText.fontSize = "14px";
    initialText.height = "auto";
    initialText.paddingTop = "20px";
    initialText.paddingBottom = "20px";
    initialText.paddingLeft = "20px";
    initialText.paddingRight = "20px";
    nonXRPanel.addControl(initialText);

    // --- Separater Text für XR-Anweisungen ---
    xrInstructionText = new BABYLON.GUI.TextBlock("xrText", "");
    xrInstructionText.fontFamily = "Helvetica";
    xrInstructionText.textWrapping = true;
    xrInstructionText.color = "white";
    xrInstructionText.fontSize = "16px";
    xrInstructionText.outlineColor = "black";
    xrInstructionText.outlineWidth = 2;
    xrInstructionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    xrInstructionText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    xrInstructionText.top = "20px";
    xrInstructionText.height = "60px";
    xrInstructionText.isVisible = false; // Initial unsichtbar

    // --- "Fertig"-Button ---
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    fertigButton.width = "150px";
    fertigButton.height = "40px";
    fertigButton.color = "white";
    fertigButton.background = "green";
    fertigButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    fertigButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    fertigButton.top = "-20px";
    fertigButton.isVisible = false; // Initial unsichtbar

    // Click-Handler für den "Fertig"-Button (bleibt gleich)
    if (fertigButton) {
        fertigButton.onPointerClickObservable.add(() => {
            if (fertigButton && fertigButton.isVisible && mode === 0) {
                console.log("Fertig Button geklickt! Wechsle zu Modus 1.");
                mode = 1;
                fertigButton.isVisible = false;
                if (defaultObject) defaultObject.isVisible = false;
                if (xrInstructionText) xrInstructionText.text = "Modus 1: Tippe zum Ändern der Farbe.";
            } else {
                 console.log("Fertig Button Klick ignoriert. Mode:", mode, "Visible:", fertigButton?.isVisible);
            }
        });
    } else {
         console.error("FEHLER: fertigButton konnte nicht erstellt werden!");
    }

    // Funktion zur Erstellung des Reticles (unverändert)
    function createStandardObj() { /* ... unverändert ... */ }

    // Funktion zur Manipulation (Skalieren + Button anzeigen) (unverändert)
    function manipulateObject(obj) { /* ... unverändert ... */ }

    // Text basierend auf AR-Verfügbarkeit setzen (für initialText)
    if (initialText) {
        if (!arAvailable) {
            initialText.text = "AR is not available in your system...";
            console.log("createScene: Initialer Text gesetzt (AR nicht verfügbar).");
        } else {
            initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
            console.log("createScene: Initialer Text gesetzt (AR verfügbar).");
        }
    } else {
        console.error("FEHLER: initialText konnte nicht gefunden werden, um Text zu setzen!");
    }

    // Reticle initial erstellen (vor XR Init)
    createStandardObj();

    // --- XR Experience Helper erstellen (im Try-Catch) ---
    try {
        console.log("createScene: Versuche XR Experience zu erstellen...");
        xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: { sessionMode: "immersive-ar", referenceSpaceType: "local-floor", onError: (error) => { /*...*/ } },
            optionalFeatures: true
        });
        console.log("createScene: XR Experience erstellt/initialisiert.");

        if (!xr || !xr.baseExperience) throw new Error("XR Base Experience konnte nicht initialisiert werden (nach await).");

        // *** KORREKTUR: Holen des XR UI Layers NACH XR Initialisierung ***
        advancedTexture = xr.baseExperience.uiLayer;
        if (!advancedTexture) {
            console.error("FEHLER: Konnte xr.baseExperience.uiLayer nicht abrufen!");
            // Hier könnte man versuchen, eine manuelle Textur zu erstellen, aber das führt wieder zum Problem
            // Besser ist es, hier abzubrechen oder eine Fehlermeldung anzuzeigen.
            throw new Error("XR UI Layer nicht verfügbar.");
        } else {
             console.log("createScene: advancedTexture von xr.baseExperience.uiLayer erhalten.");
             // *** GUI Elemente JETZT zur korrekten Textur hinzufügen ***
             advancedTexture.addControl(startUI_bg); // Start-UI (wird später in XR ausgeblendet)
             advancedTexture.addControl(xrInstructionText); // XR-Text
             advancedTexture.addControl(fertigButton); // Fertig-Button
             console.log("createScene: GUI Controls zur XR uiLayer hinzugefügt.");
        }

        // XR Session Lifecycle Handling (unverändert zur letzten Version)
        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
            console.log("XR Session gestartet.");
            if (startUI_bg) startUI_bg.isVisible = false; // Nur das Start-Panel ausblenden
            if (xrInstructionText) {
                xrInstructionText.text = "Finde eine Oberfläche und tippe zum Platzieren.";
                xrInstructionText.isVisible = true;
            }
            mode = 0;
            if (fertigButton) fertigButton.isVisible = false;
        });
        xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
            console.log("XR Session beendet.");
            if (startUI_bg) startUI_bg.isVisible = true;
            if (xrInstructionText) xrInstructionText.isVisible = false;
            mode = 0;
            if (fertigButton) fertigButton.isVisible = false;
            if(firstObject) { firstObject.dispose(); firstObject = null; }
            if (initialText) initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
        });

        const fm = xr.baseExperience.featuresManager;

        // Hit-Test-Feature aktivieren (unverändert)
        const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
        if (!xrTest) { /* ... Fehlerbehandlung ... */ }
        else {
            console.log("createScene: Hit-Test Feature aktiviert.");
            xrTest.onHitTestResultObservable.add((results) => { /* ... unverändert ... */ });
        } // Ende Hit-Test Logik

        // Controller Input verarbeiten (unverändert)
        if (xr.baseExperience.inputManager) { /* ... unverändert ... */ }
        else { console.warn("XR Input Manager nicht gefunden!"); }

    } catch (xrError) {
         console.error("FEHLER während der XR-Initialisierung oder UI-Zuweisung:", xrError);
         if (initialText) initialText.text = "XR Init Error: " + xrError.message;
    }

    // Pointer Down Handler (unverändert)
    scene.onPointerDown = (evt, pickInfo) => { /* ... unverändert ... */ };

    console.log("createScene: Ende, gebe Szene zurück.");
    return scene;
}; // Ende createScene

// Event Listener für Resize (unverändert)
window.addEventListener("resize", function () { if (engine) engine.resize(); });

// App Initialisierung (unverändert)
async function initializeApp() { /* ... unverändert ... */ }

// App starten (unverändert)
document.addEventListener("DOMContentLoaded", initializeApp);