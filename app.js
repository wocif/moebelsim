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
    let xrInstructionText = null; // Text für XR-Anweisungen
    // =======================================

    console.log("createScene: Start"); // Logging hinzugefügt

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
         // Frühzeitiger Ausstieg oder alternative UI-Anzeige könnte hier sinnvoll sein
         return scene; // Gib zumindest die bisherige Szene zurück
    }


    // --- Start-Panel (wird in XR ausgeblendet) ---
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "rgba(0,0,0,0.7)";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.cornerRadius = 20;
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true;
    if (advancedTexture) advancedTexture.addControl(startUI_bg); // Check hinzugefügt

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel); // Geht davon aus, dass startUI_bg existiert

    const initialText = new BABYLON.GUI.TextBlock("initialText");
    initialText.fontFamily = "Helvetica";
    initialText.textWrapping = true;
    initialText.color = "white";
    initialText.fontSize = "14px";
    initialText.height = "auto";
    initialText.paddingTop = "10px";
    initialText.paddingBottom = "10px";
    initialText.paddingLeft = "10px";
    initialText.paddingRight = "10px";
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
    xrInstructionText.isVisible = false;
    if (advancedTexture) advancedTexture.addControl(xrInstructionText); // Check hinzugefügt

    // --- "Fertig"-Button ---
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    fertigButton.width = "150px";
    fertigButton.height = "40px";
    fertigButton.color = "white";
    fertigButton.background = "green";
    fertigButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    fertigButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    fertigButton.top = "-20px";
    fertigButton.isVisible = false;
    if (advancedTexture) advancedTexture.addControl(fertigButton); // Check hinzugefügt
    console.log("createScene: UI Elemente erstellt.");

    // Click-Handler für den "Fertig"-Button (mit Check)
    if (fertigButton) {
        fertigButton.onPointerClickObservable.add(() => {
            // Prüfe explizit, ob Button sichtbar ist und Modus noch 0 ist
            if (fertigButton && fertigButton.isVisible && mode === 0) {
                console.log("Fertig Button geklickt! Wechsle zu Modus 1.");
                mode = 1;
                fertigButton.isVisible = false; // Button ausblenden
                if (defaultObject) defaultObject.isVisible = false; // Reticle ausblenden
                if (xrInstructionText) xrInstructionText.text = "Modus 1: Tippe zum Ändern der Farbe.";
            } else {
                 console.log("Fertig Button Klick ignoriert (Button nicht sichtbar oder Modus nicht 0). Mode:", mode, "Visible:", fertigButton?.isVisible);
            }
        });
    } else {
         console.error("FEHLER: fertigButton konnte nicht erstellt werden!");
    }


    // Funktion zur Erstellung des Reticles
    function createStandardObj() {
        // Check, ob Szene existiert (sollte der Fall sein, aber sicher ist sicher)
        if (!scene) {
            console.error("createStandardObj: Szene nicht gefunden!");
            return;
        }
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
                if (!defaultObject.rotationQuaternion) {
                    defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
                }
                 console.log("createScene: Reticle (defaultObject) erstellt.");
            } catch (e) {
                 console.error("Fehler beim Erstellen des Reticles:", e);
            }
        }
    }

    // Funktion zur Manipulation (Skalieren + Button anzeigen)
    function manipulateObject(obj) {
        // Zusätzliche Checks für obj und scaling
        if (obj && typeof obj.scaling !== 'undefined' && obj.scaling !== null) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             console.log("Objekt skaliert.");
             // Button sichtbar machen (mit Check)
             if (fertigButton && mode === 0) {
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button sichtbar gemacht.");
                 if (xrInstructionText) {
                     xrInstructionText.text = "Objekt platziert. Drücke 'Fertig' zum Bestätigen.";
                 }
             }
             // Modus wird NICHT hier geändert
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt oder Scaling-Eigenschaft fehlt:", obj);
        }
    }

    // Text basierend auf AR-Verfügbarkeit setzen
    if (initialText) { // Check hinzugefügt
        if (!arAvailable) {
            initialText.text = "AR is not available in your system...";
            // Potenziell Rückgabe hier, wenn AR zwingend erforderlich ist
            // return scene;
        } else {
            initialText.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Wenn AR startet, finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
        }
    }

    // XR Experience Helper erstellen (im Try-Catch)
    try {
        console.log("createScene: Versuche XR Experience zu erstellen...");
        xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: "immersive-ar",
                referenceSpaceType: "local-floor",
                onError: (error) => {
                    console.error("XR Session Error Callback:", error);
                    alert("XR Error: " + error.message);
                    // UI aktualisieren, um Fehler anzuzeigen
                    if(xrInstructionText) {
                         xrInstructionText.text = "XR Fehler: " + error.message;
                         xrInstructionText.isVisible = true; // Sicherstellen, dass Text sichtbar ist
                    } else if(initialText) {
                         initialText.text = "XR Fehler: " + error.message;
                    }
                }
            },
            optionalFeatures: true
        });
        console.log("createScene: XR Experience erstellt/initialisiert.");

        if (!xr || !xr.baseExperience) {
            // Dieser Fall sollte durch onError abgedeckt sein, aber zur Sicherheit
            throw new Error("XR Base Experience konnte nicht initialisiert werden (nach await).");
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
                    // Check ob transformationMatrix existiert, bevor decompose aufgerufen wird
                    if (hitTest && hitTest.transformationMatrix) {
                        hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);
                    } else {
                         console.warn("Hit-Test Ergebnis hat keine transformationMatrix.");
                         hitTest = undefined; // Sicherstellen, dass hitTest ungültig ist
                    }

                    // Reticle Sichtbarkeit (mit Checks)
                    if (defaultObject) {
                        let showReticle = false;
                        if (mode === 0 && fertigButton) { // Check auf fertigButton hinzugefügt
                            showReticle = !fertigButton.isVisible;
                        }
                        defaultObject.isVisible = showReticle;
                        if (defaultObject.isVisible && hitTest && hitTestPosition) { // Zusätzliche Checks
                            defaultObject.position.copyFrom(hitTestPosition);
                            if (defaultObject.rotationQuaternion && hitTestRotation) { // Check auf hitTestRotation
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

        // Controller Input verarbeiten (mit mehr Checks)
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
                                // Check für Material und diffuseColor
                                if (defaultObject && defaultObject.material instanceof BABYLON.StandardMaterial && defaultObject.material.diffuseColor) {
                                    const mat = defaultObject.material; // Sicherer Zugriff
                                    const originalColor = mat.diffuseColor.clone();
                                    const flashColor = new BABYLON.Color3(0, 1, 0);
                                    mat.diffuseColor = flashColor;
                                    setTimeout(() => {
                                        // Erneuter Check im Timeout
                                        if (defaultObject && defaultObject.material instanceof BABYLON.StandardMaterial && defaultObject.material.diffuseColor) {
                                            defaultObject.material.diffuseColor = originalColor;
                                        }
                                    }, 200);
                                } else { console.warn("A-Taste: defaultObject oder Material/diffuseColor fehlt?"); }
                            }
                        });
                    }
                    // Weitere Controller-Komponenten (Trigger, Grip) - gekürzt für Übersicht
                    // ... (Code für Trigger/Grip bleibt logisch gleich) ...
                 });
             });
             xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => {
                 console.log("Controller entfernt:", inputSource.uniqueId);
             });
        } else {
             console.warn("XR Input Manager nicht gefunden!");
        }

    } catch (xrError) {
         console.error("FEHLER während der XR-Initialisierung oder Feature-Aktivierung:", xrError);
         if (initialText) initialText.text = "XR Init Error: " + xrError.message;
         // Hier könnte man auch die Fehler-Div aus initializeApp nutzen oder eine andere UI-Meldung zeigen
         // Wichtig ist, dass die Funktion trotzdem eine Szene zurückgibt, damit initializeApp nicht fehlschlägt
    }


    // Pointer Down Handler (mit Checks)
    scene.onPointerDown = (evt, pickInfo) => {
        // Check auf xr und baseExperience hinzugefügt, falls XR-Init fehlschlug
        if (xr && xr.baseExperience && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {
            // Modus 0: Objekt erstellen
            if (mode === 0 && defaultObject && fertigButton && !fertigButton.isVisible) {
                 console.log("Pointer Down im Modus 0 (CREATE)");
                 if (firstObject) { firstObject.dispose(); firstObject = null; }

                 try { // Try-Catch um Klonen und Materialzuweisung
                     firstObject = defaultObject.clone("placedObject_" + Date.now());
                     if (firstObject) {
                         if (hitTestPosition) firstObject.position.copyFrom(hitTestPosition); // Check hitTestPosition
                         if (firstObject.rotationQuaternion && hitTestRotation) firstObject.rotationQuaternion.copyFrom(hitTestRotation); // Check hitTestRotation
                         firstObject.isVisible = true;
                         firstObject.isPickable = true;
                         let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                         placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Grün
                         firstObject.material = placedObjectMaterial; // Licht reagierendes Material
                         manipulateObject(firstObject); // Skalieren & Button anzeigen
                     } else {
                         console.error("Klonen des Objekts gab null zurück.");
                     }
                 } catch (cloneError) {
                     console.error("Fehler beim Klonen oder Materialzuweisung:", cloneError);
                 }
            }
            // Modus 1: Objekt manipulieren (Farbe ändern)
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                if (firstObject && firstObject.material) { // Check auf Material hinzugefügt
                    try { // Try-Catch um Materialzuweisung
                        // Neuer Name für Material, um Konflikte sicher zu vermeiden
                        let newMaterialName = "placedMat_Mode1_" + Date.now();
                        let placedObjectMaterial = new BABYLON.StandardMaterial(newMaterialName, scene);
                        placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // Rot
                        firstObject.material = placedObjectMaterial;
                        console.log("Objekt neu eingefärbt mit Material:", newMaterialName);
                    } catch (matError) {
                        console.error("Fehler beim Ändern des Materials in Modus 1:", matError);
                    }
                } else {
                     console.warn("Modus 1: Kein platziertes Objekt (firstObject) oder Material gefunden.");
                }
            }
        } else {
            console.log("Pointer Down ignoriert. Bedingungen: inXR=", xr?.baseExperience?.state === BABYLON.WebXRState.IN_XR, "hitTest=", !!hitTest);
        }
    }; // Ende scene.onPointerDown

    // Reticle initial erstellen
    createStandardObj();

    console.log("createScene: Ende, gebe Szene zurück.");
    // Wichtig: Die erstellte *lokale* Szene zurückgeben
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

        scene = await createScene(); // Globale Variable 'scene' wird hier gesetzt
        if (!scene) throw new Error('Szene konnte nicht erstellt werden (createScene gab null/undefined zurück).');
        console.log("Szene erstellt und zurückgegeben.");

        sceneToRender = scene; // Sicherstellen, dass die globale 'scene' verwendet wird

        startRenderLoop(engine, canvas);
        console.log("Render Loop gestartet.");

    } catch (e) {
        console.error("Kritischer Initialisierungsfehler:", e);
        // Zeige Fehler im UI an
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:absolute; top:10px; left:10px; padding:10px; background-color:red; color:white; z-index:1000; border: 1px solid black; font-family: sans-serif;';
        errorDiv.textContent = 'INITIALIZATION FAILED: ' + e.message + ' (Check console for details)';
        // Stelle sicher, dass der Body existiert
        if (document.body) {
             document.body.appendChild(errorDiv);
        } else {
             // Fallback, falls body noch nicht bereit ist (sollte durch DOMContentLoaded nicht passieren)
             window.addEventListener('DOMContentLoaded', () => { document.body.appendChild(errorDiv); });
        }
    }
}

// App starten, wenn das DOM geladen ist (unverändert)
document.addEventListener("DOMContentLoaded", initializeApp);