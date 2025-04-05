// === VOLLSTÄNDIGER CODE ===

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
    // Prüfen, ob das Canvas-Element gefunden wurde
    if (!canvas) {
        console.error("FEHLER: Canvas-Element 'renderCanvas' nicht im DOM gefunden!");
        return null; // Frühzeitiger Ausstieg, wenn Canvas fehlt
    }
    try {
        const eng = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false
        });
        console.log("Babylon.js Engine erstellt.");
        return eng;
    } catch(e) {
        console.error("FEHLER beim Erstellen der Babylon.js Engine:", e);
        return null;
    }
};

// Asynchrone Funktion zur Erstellung der Szene
const createScene = async function () {
    // Prüfen, ob die Engine übergeben wurde (wichtig für Scene-Konstruktor)
    if (!engine) {
        console.error("FEHLER: Engine nicht initialisiert, bevor createScene aufgerufen wurde.");
        return null; // Frühzeitiger Ausstieg
    }

    // Zuerst die lokale BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine);
    console.log("createScene: Szene-Objekt erstellt.");

    // === Lokale Variablen für diese Szene ===
    let defaultObject = null; // Das Reticle/Platzierungsobjekt
    let firstObject = null; // Das erste platzierte Objekt
    let hitTest = undefined;
    let hitTestPosition = new BABYLON.Vector3();
    let hitTestRotation = new BABYLON.Quaternion();
    let xr = null; // Wird später initialisiert
    let fertigButton = null; // Button zum Wechseln des Modus
    let initialText = null; // Text im Start-Panel
    let xrInstructionText = null; // Text für XR-Anweisungen
    let advancedTexture = null; // Wird erst nach XR-Init zugewiesen
    let startUI_bg = null; // Deklaration für spätere Referenz
    // =======================================

    console.log("createScene: Start der Szenenkonfiguration");

    // Kamera erstellen
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1;
    camera.attachControl(canvas, true); // Annahme: canvas existiert hier

    // Lichtquellen erstellen
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene);
    light.intensity = 1.7;
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene);
    light2.intensity = 1.5;
    var testLight = new BABYLON.HemisphericLight("testLight", new BABYLON.Vector3(0, 1, 0), scene);
    testLight.intensity = 3; // Leicht reduziert

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    console.log("createScene: AR Available =", arAvailable);

    // --- GUI Elemente werden nur deklariert und konfiguriert ---
    // --- Sie werden erst NACH XR-Initialisierung zur advancedTexture hinzugefügt ---

    // Start-Panel
    startUI_bg = new BABYLON.GUI.Rectangle("startRect"); // Zuweisung zur Variable
    startUI_bg.background = "rgba(0,0,0,0.7)";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.cornerRadius = 20;
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true; // Initial sichtbar

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel); // Hier zum Rectangle hinzufügen ist ok

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
    nonXRPanel.addControl(initialText); // Hier zum Panel hinzufügen ist ok

    // Separater Text für XR-Anweisungen
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

    // "Fertig"-Button
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    fertigButton.width = "150px";
    fertigButton.height = "40px";
    fertigButton.color = "white";
    fertigButton.background = "green";
    fertigButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    fertigButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    fertigButton.top = "-20px";
    fertigButton.isVisible = false; // Initial unsichtbar
    console.log("createScene: Grundlegende GUI-Elemente konfiguriert.");

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
         console.error("FEHLER: fertigButton ist null nach der Erstellung!");
    }

    // Funktion zur Erstellung des Reticles
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

    // Funktion zur Manipulation (Skalieren + Button anzeigen)
    function manipulateObject(obj) {
        if (obj && typeof obj.scaling !== 'undefined' && obj.scaling !== null) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             console.log("Objekt skaliert.");
             // Button sichtbar machen (mit Check auf Existenz)
             if (fertigButton) {
                 console.log("Versuche Fertig-Button sichtbar zu machen...");
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button.isVisible gesetzt auf:", fertigButton.isVisible);
                 // XR-Anweisungstext aktualisieren
                 if (xrInstructionText) {
                     xrInstructionText.text = "Objekt platziert. Drücke 'Fertig' zum Bestätigen.";
                 }
             } else {
                 console.warn("manipulateObject: fertigButton nicht gefunden!");
             }
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt oder Scaling fehlt:", obj);
        }
    }

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
        console.error("FEHLER: initialText ist null, Text kann nicht gesetzt werden!");
    }

    // Reticle initial erstellen (vor XR Init)
    createStandardObj();

    // XR Experience Helper erstellen (im Try-Catch)
    try {
        console.log("createScene: Versuche XR Experience zu erstellen...");
        xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: { sessionMode: "immersive-ar", referenceSpaceType: "local-floor", onError: (error) => {
                console.error("XR Session Error Callback:", error);
                alert("XR Error: " + error.message);
                 if(xrInstructionText) {
                     xrInstructionText.text = "XR Fehler: " + error.message;
                     xrInstructionText.isVisible = true;
                 } else if(initialText) {
                     initialText.text = "XR Fehler: " + error.message;
                 }
            } },
            optionalFeatures: true
        });
        console.log("createScene: XR Experience erstellt/initialisiert.");

        if (!xr || !xr.baseExperience) throw new Error("XR Base Experience konnte nicht initialisiert werden (nach await).");

        // *** KORREKTUR: Holen des XR UI Layers und Hinzufügen der Controls ***
        advancedTexture = xr.baseExperience.uiLayer;
        if (!advancedTexture) {
            console.error("FEHLER: Konnte xr.baseExperience.uiLayer nicht abrufen!");
            throw new Error("XR UI Layer nicht verfügbar.");
        } else {
             console.log("createScene: advancedTexture von xr.baseExperience.uiLayer erhalten.");
             // GUI Elemente zur korrekten Textur hinzufügen
             // Es ist wichtig, dass diese Variablen (startUI_bg etc.) hier gültig sind
             if (startUI_bg) advancedTexture.addControl(startUI_bg); else console.error("startUI_bg ist null beim Hinzufügen!");
             if (xrInstructionText) advancedTexture.addControl(xrInstructionText); else console.error("xrInstructionText ist null beim Hinzufügen!");
             if (fertigButton) advancedTexture.addControl(fertigButton); else console.error("fertigButton ist null beim Hinzufügen!");
             console.log("createScene: GUI Controls zur XR uiLayer hinzugefügt.");
        }

        // XR Session Lifecycle Handling (mit Checks)
        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
            console.log("XR Session gestartet.");
            if (startUI_bg) startUI_bg.isVisible = false;
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
                    } else { hitTest = undefined; }

                    // Reticle Sichtbarkeit (mit Checks)
                    if (defaultObject) {
                        let showReticle = false;
                        if (mode === 0 && fertigButton) { // Check auf fertigButton hier wichtig
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
                    if (defaultObject) defaultObject.isVisible = false;
                }
            });
        } // Ende Hit-Test Logik

        // Controller Input verarbeiten (mit Checks)
        if (xr.baseExperience.inputManager) {
             console.log("createScene: Input Manager gefunden, füge Controller Listener hinzu.");
             xr.baseExperience.inputManager.onControllerAddedObservable.add((inputSource) => {
                 console.log("Controller verbunden:", inputSource.uniqueId);
                 inputSource.onMotionControllerInitObservable.add((motionController) => {
                    console.log("Motion Controller initialisiert:", motionController.profileId);
                    // A-Taste Handler (mit Material-Check)
                    const aButtonComponent = motionController.getComponent("a-button");
                    if (aButtonComponent) {
                        aButtonComponent.onButtonStateChangedObservable.add((component) => {
                            if (component.pressed) {
                                console.log("A-Taste GEDRÜCKT!");
                                if (defaultObject && defaultObject.material instanceof BABYLON.StandardMaterial && defaultObject.material.diffuseColor) {
                                    const mat = defaultObject.material;
                                    const originalColor = mat.diffuseColor.clone();
                                    const flashColor = new BABYLON.Color3(0, 1, 0);
                                    mat.diffuseColor = flashColor;
                                    setTimeout(() => {
                                        if (defaultObject && defaultObject.material instanceof BABYLON.StandardMaterial && defaultObject.material.diffuseColor) {
                                            defaultObject.material.diffuseColor = originalColor;
                                        }
                                    }, 200);
                                } else { console.warn("A-Taste: defaultObject oder Material/diffuseColor fehlt?"); }
                            } else { console.log("A-Taste LOSGELASSEN!"); }
                        });
                    } else { console.warn("Keine A-Button Komponente gefunden."); }

                    // Trigger Handler
                    const triggerComponent = motionController.getComponent("xr-standard-trigger");
                    if (triggerComponent) {
                        console.log("Trigger Komponente gefunden.");
                        triggerComponent.onButtonStateChangedObservable.add((component) => {
                            console.log(`Trigger Zustand: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        });
                    } else { console.warn("Keine Trigger Komponente gefunden."); }

                    // Grip Handler
                    const gripComponent = motionController.getComponent("xr-standard-squeeze");
                    if (gripComponent) {
                        console.log("Grip Komponente gefunden.");
                        gripComponent.onButtonStateChangedObservable.add((component) => {
                            console.log(`Grip Zustand: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        });
                    } else { console.warn("Keine Grip Komponente gefunden."); }

                 });
             });
             xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => {
                 console.log("Controller entfernt:", inputSource.uniqueId);
             });
        } else {
             console.warn("XR Input Manager nicht gefunden!");
        }

    } catch (xrError) {
         console.error("FEHLER während der XR-Initialisierung oder UI-Zuweisung:", xrError);
         // UI informieren, falls möglich
         if (initialText) {
             initialText.text = "XR Init Error: " + xrError.message;
             // Sicherstellen, dass das Start-Panel sichtbar ist, um den Fehler anzuzeigen
             if (startUI_bg) startUI_bg.isVisible = true;
         } else {
             alert("XR Init Error: " + xrError.message); // Fallback Alert
         }
    }

    // Pointer Down Handler (mit Checks)
    scene.onPointerDown = (evt, pickInfo) => {
        // Prüfen, ob XR überhaupt initialisiert wurde und aktiv ist
        if (xr && xr.baseExperience && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {
            // Modus 0: Objekt erstellen
            // Check auf fertigButton hinzugefügt
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
                         placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Grün
                         firstObject.material = placedObjectMaterial;
                         manipulateObject(firstObject); // Skalieren & Button anzeigen
                     } else { console.error("Klonen gab null zurück."); }
                 } catch (cloneError) { console.error("Fehler beim Klonen/Material:", cloneError); }
            }
            // Modus 1: Objekt manipulieren (Farbe ändern)
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                if (firstObject && firstObject.material) {
                    try {
                        let newMaterialName = "placedMat_Mode1_" + Date.now();
                        let placedObjectMaterial = new BABYLON.StandardMaterial(newMaterialName, scene);
                        placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // Rot
                        firstObject.material = placedObjectMaterial;
                        console.log("Objekt neu eingefärbt mit Material:", newMaterialName);
                    } catch (matError) { console.error("Fehler beim Ändern des Materials in Modus 1:", matError); }
                } else { console.warn("Modus 1: Kein platziertes Objekt/Material gefunden."); }
            }
        } else {
            // Detailliertere Log-Ausgabe
            console.log("Pointer Down ignoriert. Bedingungen: XR=", !!(xr && xr.baseExperience), "State=", xr?.baseExperience?.state, "HitTest=", !!hitTest);
        }
    }; // Ende scene.onPointerDown

    console.log("createScene: Ende, gebe Szene zurück.");
    // Wichtig: Die erstellte *lokale* Szene zurückgeben, auch wenn Fehler auftraten
    return scene;
}; // Ende createScene

// Event Listener für Resize
window.addEventListener("resize", function () {
    if (engine) {
        console.log("Fenstergröße geändert, rufe engine.resize() auf.");
        engine.resize();
    }
});

// App Initialisierung
async function initializeApp() {
    console.log("DOMContentLoaded -> initializeApp: Start.");
    try {
        engine = createDefaultEngine();
        // Prüfen, ob Engine erfolgreich erstellt wurde
        if (!engine) {
            throw new Error('Engine konnte nicht erstellt werden (siehe vorherige Konsolenfehler).');
        }
        console.log("initializeApp: Engine erstellt.");

        scene = await createScene(); // Globale Variable 'scene' wird hier gesetzt
        // Prüfen, ob Szene erfolgreich erstellt wurde
        if (!scene) {
             throw new Error('Szene konnte nicht erstellt werden (createScene gab null/undefined zurück).');
        }
        console.log("initializeApp: Szene erstellt und zurückgegeben.");

        sceneToRender = scene; // Sicherstellen, dass die globale 'scene' verwendet wird

        // Prüfen, ob die Render-Loop gestartet werden kann
        if (sceneToRender && engine) {
            startRenderLoop(engine, canvas);
            console.log("initializeApp: Render Loop gestartet.");
        } else {
             throw new Error('Render Loop konnte nicht gestartet werden (Szene oder Engine fehlt).');
        }

    } catch (e) {
        console.error("Kritischer Initialisierungsfehler in initializeApp:", e);
        // Zeige Fehler im UI an (versuche es erneut, falls body vorher nicht bereit war)
        const errorDivId = "initErrorDiv";
        let errorDiv = document.getElementById(errorDivId);
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = errorDivId;
            errorDiv.style.cssText = 'position:absolute; top:10px; left:10px; padding:10px; background-color:rgba(200,0,0,0.9); color:white; z-index:10000; border: 2px solid black; font-family: monospace; max-width: 90%;';
            if (document.body) {
                document.body.appendChild(errorDiv);
            } else {
                // Fallback, falls Body wirklich nicht existiert
                window.addEventListener('load', () => document.body.appendChild(errorDiv));
            }
        }
        // Fehlertext aktualisieren (hilfreich bei wiederholten Fehlern)
        errorDiv.innerHTML = '<strong>INITIALIZATION FAILED:</strong><br>' + e.message + '<br>(Check browser console for more details)';
    }
}

// App starten, wenn das DOM geladen ist
document.addEventListener("DOMContentLoaded", initializeApp);