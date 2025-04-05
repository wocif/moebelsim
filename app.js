// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene; // Globale Szene-Variable, wird in initializeApp gesetzt

let mode = 0; // 0 = CREATE, 1 = MANIPULATE

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
    let firstObject = null; // Das erste platzierte Objekt
    let hitTest = undefined;
    let hitTestPosition = new BABYLON.Vector3();
    let hitTestRotation = new BABYLON.Quaternion();
    let xr = null; // Wird später initialisiert
    let fertigButton = null; // Button zum Wechseln des Modus
    let initialText = null; // *** Der Text im Start-Panel (vormals text1) ***
    let xrInstructionText = null; // Text für XR-Anweisungen
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

    // GUI Elemente erstellen
    let advancedTexture = null;
    try {
         advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
         console.log("createScene: AdvancedDynamicTexture erstellt.");
    } catch (e) {
         console.error("Fehler beim Erstellen der AdvancedDynamicTexture:", e);
         return scene; // Frühzeitiger Ausstieg
    }

    // --- Start-Panel (wird in XR ausgeblendet) ---
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "rgba(0,0,0,0.7)";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%"; // Höhe angepasst für Text
    startUI_bg.cornerRadius = 20;
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true; // Sicherstellen, dass es initial sichtbar ist
    if (advancedTexture) advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel);

    // *** Korrektur: Initialer Text wird hier erstellt und dem Panel hinzugefügt ***
    initialText = new BABYLON.GUI.TextBlock("initialText");
    initialText.fontFamily = "Helvetica";
    initialText.textWrapping = true;
    initialText.color = "white";
    initialText.fontSize = "14px";
    initialText.height = "auto"; // Höhe automatisch
    initialText.paddingTop = "20px"; // Mehr Padding
    initialText.paddingBottom = "20px";
    initialText.paddingLeft = "20px";
    initialText.paddingRight = "20px";
    nonXRPanel.addControl(initialText); // Zum Panel hinzufügen

    // --- Separater Text für XR-Anweisungen ---
    xrInstructionText = new BABYLON.GUI.TextBlock("xrText", "");
    // ... (Konfiguration für xrInstructionText bleibt gleich) ...
    xrInstructionText.isVisible = false; // Initial unsichtbar
    if (advancedTexture) advancedTexture.addControl(xrInstructionText);

    // --- "Fertig"-Button ---
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    // ... (Konfiguration für fertigButton bleibt gleich) ...
    fertigButton.isVisible = false; // Initial unsichtbar
    if (advancedTexture) advancedTexture.addControl(fertigButton);
    console.log("createScene: UI Elemente (inkl. Button) erstellt.");

    // Click-Handler für den "Fertig"-Button (mit Check)
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
    function createStandardObj() {
        if (!scene) { console.error("createStandardObj: Szene nicht gefunden!"); return; }
        if (!defaultObject) {
            try {
                defaultObject = BABYLON.MeshBuilder.CreateBox("standardBox", { width: 0.2, height: 0.1, depth: 0.05, updatable: true }, scene);
                let standardObjMaterial = new BABYLON.StandardMaterial("reticleMaterial", scene);
                standardObjMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1);
                standardObjMaterial.roughness = 1;
                standardObjMaterial.disableLighting = true;
                standardObjMaterial.backFaceCulling = false;
                defaultObject.material = standardObjMaterial;
                defaultObject.renderingGroupId = 1;
                defaultObject.isVisible = false;
                defaultObject.isPickable = false;
                if (!defaultObject.rotationQuaternion) defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
                console.log("createScene: Reticle (defaultObject) erstellt.");
            } catch (e) { console.error("Fehler beim Erstellen des Reticles:", e); }
        }
    }

    // *** START DER ÄNDERUNG an manipulateObject ***
    // Funktion zur Manipulation (Skalieren + Button anzeigen)
    function manipulateObject(obj) {
        if (obj && typeof obj.scaling !== 'undefined' && obj.scaling !== null) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             console.log("Objekt skaliert.");
             // Button sichtbar machen (mit Check auf Existenz)
             // *** Entfernt: mode === 0 Check, da manipulateObject nur im Modus 0 aufgerufen wird ***
             if (fertigButton) {
                 console.log("Versuche Fertig-Button sichtbar zu machen..."); // Log hinzugefügt
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button.isVisible gesetzt auf:", fertigButton.isVisible); // Überprüfung
                 // XR-Anweisungstext aktualisieren
                 if (xrInstructionText) {
                     xrInstructionText.text = "Objekt platziert. Drücke 'Fertig' zum Bestätigen.";
                 }
             } else {
                 console.warn("manipulateObject: fertigButton nicht gefunden!"); // Warnung, falls Button fehlt
             }
             // Modus wird NICHT hier geändert
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt oder Scaling-Eigenschaft fehlt:", obj);
        }
    }
    // *** ENDE DER ÄNDERUNG an manipulateObject ***

    // Text basierend auf AR-Verfügbarkeit setzen (für initialText)
    // *** Korrektur: Sicherstellen, dass initialText existiert ***
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


    // XR Experience Helper erstellen (im Try-Catch)
    try {
        console.log("createScene: Versuche XR Experience zu erstellen...");
        xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: { sessionMode: "immersive-ar", referenceSpaceType: "local-floor", onError: (error) => { /*...*/ } },
            optionalFeatures: true
        });
        console.log("createScene: XR Experience erstellt/initialisiert.");

        if (!xr || !xr.baseExperience) throw new Error("XR Base Experience konnte nicht initialisiert werden (nach await).");

        // XR Session Lifecycle Handling (mit Checks)
        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
            console.log("XR Session gestartet.");
            if (startUI_bg) startUI_bg.isVisible = false;
            if (xrInstructionText) {
                xrInstructionText.text = "Finde eine Oberfläche und tippe zum Platzieren.";
                xrInstructionText.isVisible = true;
            }
            mode = 0;
            if (fertigButton) fertigButton.isVisible = false; // Sicherstellen, dass Button bei Start aus ist
        });
        xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
            console.log("XR Session beendet.");
            if (startUI_bg) startUI_bg.isVisible = true;
            if (xrInstructionText) xrInstructionText.isVisible = false;
            mode = 0;
            if (fertigButton) fertigButton.isVisible = false;
            if(firstObject) { firstObject.dispose(); firstObject = null; }
            // Initialen Text wiederherstellen
            if (initialText) initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
        });

        const fm = xr.baseExperience.featuresManager;

        // Hit-Test-Feature aktivieren (mit Checks)
        const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
        if (!xrTest) {
            console.warn("WebXR Hit Test Feature ist nicht verfügbar.");
            if (xrInstructionText) xrInstructionText.text = "Hit-Test nicht verfügbar!";
        } else {
            console.log("createScene: Hit-Test Feature aktiviert.");
            xrTest.onHitTestResultObservable.add((results) => {
                if (results.length) {
                    hitTest = results[0];
                    if (hitTest && hitTest.transformationMatrix) {
                        hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);
                    } else {
                         hitTest = undefined;
                    }

                    // Reticle Sichtbarkeit (mit Checks)
                    if (defaultObject) {
                        let showReticle = false;
                        // *** Prüft jetzt nur noch, ob der Button existiert ***
                        if (mode === 0 && fertigButton) {
                             showReticle = !fertigButton.isVisible;
                        }
                        defaultObject.isVisible = showReticle;
                        if (defaultObject.isVisible && hitTest && hitTestPosition) {
                            defaultObject.position.copyFrom(hitTestPosition);
                            if (defaultObject.rotationQuaternion && hitTestRotation) {
                                defaultObject.rotationQuaternion.copyFrom(hitTestRotation);
                            }
                        }
                    }
                } else {
                    hitTest = undefined;
                    if (defaultObject) {
                        defaultObject.isVisible = false;
                    }
                }
            });
        } // Ende Hit-Test Logik

        // Controller Input verarbeiten (unverändert belassen)
        if (xr.baseExperience.inputManager) {
             console.log("createScene: Input Manager gefunden, füge Controller Listener hinzu.");
             // ... (Kompletter Code für Controller Input bleibt unverändert) ...
        } else {
             console.warn("XR Input Manager nicht gefunden!");
        }

    } catch (xrError) {
         console.error("FEHLER während der XR-Initialisierung oder Feature-Aktivierung:", xrError);
         if (initialText) initialText.text = "XR Init Error: " + xrError.message;
    }


    // Pointer Down Handler (unverändert)
    scene.onPointerDown = (evt, pickInfo) => {
        if (xr && xr.baseExperience && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {
            if (mode === 0 && defaultObject && fertigButton && !fertigButton.isVisible) {
                 console.log("Pointer Down im Modus 0 (CREATE)");
                 if (firstObject) { firstObject.dispose(); firstObject = null; }
                 try {
                     firstObject = defaultObject.clone("placedObject_" + Date.now());
                     if (firstObject) {
                         if (hitTestPosition) firstObject.position.copyFrom(hitTestPosition);
                         if (firstObject.rotationQuaternion && hitTestRotation) firstObject.rotationQuaternion.copyFrom(hitTestRotation);
                         firstObject.isVisible = true;
                         firstObject.isPickable = true;
                         let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                         placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
                         firstObject.material = placedObjectMaterial;
                         manipulateObject(firstObject); // Skalieren & Button anzeigen
                     } else { console.error("Klonen gab null zurück."); }
                 } catch (cloneError) { console.error("Fehler beim Klonen/Material:", cloneError); }
            }
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                if (firstObject && firstObject.material) {
                    try {
                        let newMaterialName = "placedMat_Mode1_" + Date.now();
                        let placedObjectMaterial = new BABYLON.StandardMaterial(newMaterialName, scene);
                        placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
                        firstObject.material = placedObjectMaterial;
                        console.log("Objekt neu eingefärbt mit Material:", newMaterialName);
                    } catch (matError) { console.error("Fehler beim Ändern des Materials in Modus 1:", matError); }
                } else { console.warn("Modus 1: Kein platziertes Objekt/Material gefunden."); }
            }
        } else {
            console.log("Pointer Down ignoriert. Bedingungen: inXR=", xr?.baseExperience?.state === BABYLON.WebXRState.IN_XR, "hitTest=", !!hitTest);
        }
    }; // Ende scene.onPointerDown

    // Reticle initial erstellen
    createStandardObj();

    console.log("createScene: Ende, gebe Szene zurück.");
    return scene;
}; // Ende createScene

// Event Listener für Resize (unverändert)
window.addEventListener("resize", function () { if (engine) engine.resize(); });

// App Initialisierung (unverändert)
async function initializeApp() {
    try {
        console.log("Initialisiere App...");
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine konnte nicht erstellt werden');
        console.log("Engine erstellt.");
        scene = await createScene();
        if (!scene) throw new Error('Szene konnte nicht erstellt werden (createScene gab null/undefined zurück).');
        console.log("Szene erstellt und zurückgegeben.");
        sceneToRender = scene;
        startRenderLoop(engine, canvas);
        console.log("Render Loop gestartet.");
    } catch (e) {
        console.error("Kritischer Initialisierungsfehler:", e);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:absolute; top:10px; left:10px; padding:10px; background-color:red; color:white; z-index:1000; border: 1px solid black; font-family: sans-serif;';
        errorDiv.textContent = 'INITIALIZATION FAILED: ' + e.message + ' (Check console for details)';
        if (document.body) document.body.appendChild(errorDiv);
        else window.addEventListener('DOMContentLoaded', () => { document.body.appendChild(errorDiv); });
    }
}

// App starten (unverändert)
document.addEventListener("DOMContentLoaded", initializeApp);