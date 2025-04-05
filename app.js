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
    let xrInstructionText = null; // *** NEU: Text für XR-Anweisungen ***
    // =======================================

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
    testLight.intensity = 3; // Etwas reduziert

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Elemente erstellen
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // --- Start-Panel (wird in XR ausgeblendet) ---
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "rgba(0,0,0,0.7)"; // Leicht transparent
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.cornerRadius = 20;
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true;
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel);

    const initialText = new BABYLON.GUI.TextBlock("initialText"); // Umbenannt für Klarheit
    initialText.fontFamily = "Helvetica";
    initialText.textWrapping = true;
    initialText.color = "white";
    initialText.fontSize = "14px";
    initialText.height = "auto";
    initialText.paddingTop = "10px";
    initialText.paddingBottom = "10px";
    initialText.paddingLeft = "10px";
    initialText.paddingRight = "10px";
    nonXRPanel.addControl(initialText); // Initialen Text zum Start-Panel hinzufügen

    // --- Separater Text für XR-Anweisungen ---
    xrInstructionText = new BABYLON.GUI.TextBlock("xrText", ""); // Leerer Text initial
    xrInstructionText.fontFamily = "Helvetica";
    xrInstructionText.textWrapping = true;
    xrInstructionText.color = "white";
    xrInstructionText.fontSize = "16px"; // Etwas größer
    xrInstructionText.outlineColor = "black"; // Bessere Lesbarkeit
    xrInstructionText.outlineWidth = 2;
    xrInstructionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Oben anzeigen
    xrInstructionText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    xrInstructionText.top = "20px"; // Abstand von oben
    xrInstructionText.height = "60px"; // Feste Höhe für 2-3 Zeilen
    xrInstructionText.isVisible = false; // Initial unsichtbar
    advancedTexture.addControl(xrInstructionText); // Direkt zur Textur hinzufügen

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
    advancedTexture.addControl(fertigButton); // *** Wichtig: Direkt zur Textur hinzufügen ***

    // Click-Handler für den "Fertig"-Button
    fertigButton.onPointerClickObservable.add(() => {
        if (fertigButton.isVisible && mode === 0) {
            console.log("Fertig Button geklickt! Wechsle zu Modus 1.");
            mode = 1;
            fertigButton.isVisible = false;
            if (defaultObject) defaultObject.isVisible = false;
            if (xrInstructionText) xrInstructionText.text = "Modus 1: Tippe zum Ändern der Farbe."; // XR Text aktualisieren
        }
    });

    // Funktion zur Erstellung des Reticles (unverändert)
    function createStandardObj() {
        if (!defaultObject) {
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
            if (!defaultObject.rotationQuaternion) {
                defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
            }
        }
    }

    // Funktion zur Manipulation (Skalieren + Button anzeigen) - Wie von dir gewünscht
    function manipulateObject(obj) {
        if (obj && obj.scaling) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             console.log("Objekt skaliert.");
             // Button sichtbar machen
             if (fertigButton && mode === 0) { // Nur im Modus 0 anzeigen
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button sichtbar gemacht.");
                 // XR-Anweisungstext aktualisieren
                 if (xrInstructionText) {
                     xrInstructionText.text = "Objekt platziert. Drücke 'Fertig' zum Bestätigen.";
                 }
             }
             // Modus wird NICHT hier geändert
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt übergeben:", obj);
        }
    }

    // Text basierend auf AR-Verfügbarkeit setzen
    if (!arAvailable) {
        initialText.text = "AR is not available in your system..."; // Text im Start-Panel
        return scene;
    } else {
        initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren."; // Text im Start-Panel
    }

    // XR Experience Helper erstellen
    xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => {
                console.error("XR Session Error:", error);
                alert("XR Error: " + error.message);
            }
        },
        optionalFeatures: true
    });

    if (!xr || !xr.baseExperience) {
        console.error("XR Base Experience konnte nicht initialisiert werden.");
        initialText.text = "Error initializing XR. Please check console."; // Fehler im Start-Panel anzeigen
        return scene;
    }

    // XR Session Lifecycle Handling
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        console.log("XR Session gestartet.");
        startUI_bg.isVisible = false; // Nur das Start-Panel ausblenden
        // *** NEU: XR-Text anzeigen ***
        if (xrInstructionText) {
            xrInstructionText.text = "Finde eine Oberfläche und tippe zum Platzieren.";
            xrInstructionText.isVisible = true;
        }
        mode = 0; // Sicherstellen, dass wir im Modus 0 starten
        if (fertigButton) fertigButton.isVisible = false; // Button sollte hier unsichtbar sein
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        console.log("XR Session beendet.");
        startUI_bg.isVisible = true; // Start-Panel wieder anzeigen
        // *** NEU: XR-Text ausblenden ***
        if (xrInstructionText) {
            xrInstructionText.isVisible = false;
        }
        mode = 0; // Modus zurücksetzen
        if (fertigButton) fertigButton.isVisible = false; // Button ausblenden
        if(firstObject) { // Platziertes Objekt entfernen
            firstObject.dispose();
            firstObject = null;
        }
        // Initialen Text wiederherstellen (oder dynamisch laden)
        initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
    });

    const fm = xr.baseExperience.featuresManager;

    // Hit-Test-Feature aktivieren
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    if (!xrTest) {
        console.warn("WebXR Hit Test Feature ist nicht verfügbar.");
        if (xrInstructionText) xrInstructionText.text = "Hit-Test nicht verfügbar!";
    } else {
        // Hit-Test Ergebnisse verarbeiten
        xrTest.onHitTestResultObservable.add((results) => {
            if (results.length) {
                hitTest = results[0];
                hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);
                // Reticle Sichtbarkeit
                if (defaultObject) {
                    // Sichtbar nur wenn mode=0 UND Button NICHT sichtbar ist
                    defaultObject.isVisible = (mode === 0 && fertigButton && !fertigButton.isVisible);
                    if (defaultObject.isVisible) {
                        defaultObject.position.copyFrom(hitTestPosition);
                        if (defaultObject.rotationQuaternion) {
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
    }

    // Controller Input verarbeiten (unverändert)
    if (xr && xr.baseExperience && xr.baseExperience.inputManager) {
        xr.baseExperience.inputManager.onControllerAddedObservable.add((inputSource) => {
             inputSource.onMotionControllerInitObservable.add((motionController) => {
                const aButtonComponent = motionController.getComponent("a-button");
                if (aButtonComponent) {
                    aButtonComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) {
                            console.log("A-Taste GEDRÜCKT!");
                            if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) {
                                const originalColor = defaultObject.material.diffuseColor.clone();
                                const flashColor = new BABYLON.Color3(0, 1, 0);
                                (defaultObject.material as BABYLON.StandardMaterial).diffuseColor = flashColor;
                                setTimeout(() => {
                                    if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) {
                                        (defaultObject.material as BABYLON.StandardMaterial).diffuseColor = originalColor;
                                    }
                                }, 200);
                            } else { console.warn("A-Taste: defaultObject oder Material fehlt?"); }
                        }
                    });
                }
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                     triggerComponent.onButtonStateChangedObservable.add((component) => { /* ... */ });
                }
                const gripComponent = motionController.getComponent("xr-standard-squeeze");
                if (gripComponent) {
                     gripComponent.onButtonStateChangedObservable.add((component) => { /* ... */ });
                }
            });
        });
        xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => { /* ... */ });
    } else {
        console.error("XR Experience oder Input Manager nicht initialisiert!");
    }

    // Pointer Down Handler (unverändert zu deiner letzten Version)
    scene.onPointerDown = (evt, pickInfo) => {
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {
            if (mode === 0 && defaultObject && fertigButton && !fertigButton.isVisible) {
                 console.log("Pointer Down im Modus 0 (CREATE)");
                 if (firstObject) { firstObject.dispose(); firstObject = null; }
                 firstObject = defaultObject.clone("placedObject_" + Date.now());
                 if (firstObject) {
                     firstObject.position.copyFrom(hitTestPosition);
                     if (firstObject.rotationQuaternion) firstObject.rotationQuaternion.copyFrom(hitTestRotation);
                     firstObject.isVisible = true;
                     firstObject.isPickable = true;
                     let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                     placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
                     firstObject.material = placedObjectMaterial;
                     manipulateObject(firstObject); // Skalieren & Button anzeigen
                 } else { console.error("Klonen fehlgeschlagen."); }
            }
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                if (firstObject && firstObject.material) {
                    let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat_Mode1", scene);
                    placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // Rot
                    firstObject.material = placedObjectMaterial;
                    console.log("Objekt neu eingefärbt.");
                } else { console.warn("Modus 1: Kein platziertes Objekt gefunden."); }
            }
        } else {
            console.log("Pointer Down ignoriert (Nicht in XR oder kein Hit-Test). State:", xr?.baseExperience?.state, "HitTest:", !!hitTest);
        }
    };

    // Reticle initial erstellen (unverändert)
    createStandardObj();

    // Szene zurückgeben
    return scene;
}; // Ende createScene

// Event Listener für Resize (unverändert)
window.addEventListener("resize", function () { if (engine) engine.resize(); });

// App Initialisierung (unverändert)
async function initializeApp() {
    try {
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine konnte nicht erstellt werden');
        scene = await createScene();
        if (!scene) throw new Error('Szene konnte nicht erstellt werden');
        sceneToRender = scene;
        startRenderLoop(engine, canvas);
    } catch (e) {
        console.error("Initialization failed:", e);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:absolute; top:10px; left:10px; padding:10px; background-color:red; color:white; z-index:1000;';
        errorDiv.textContent = 'Initialization Failed: ' + e.message;
        document.body.appendChild(errorDiv);
    }
}

// App starten (unverändert)
document.addEventListener("DOMContentLoaded", initializeApp);