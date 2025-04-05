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
    let fertigButton = null; // *** NEU: Variable für den Button ***
    // =======================================

    // Kamera erstellen -> FreeCamera für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1; // Setzt die Layer-Maske der Kamera
    camera.attachControl(canvas, true); // Kamera an das Canvas binden

    // Lichtquellen erstellen
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene);
    light.intensity = 1.7;
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene);
    light2.intensity = 1.5;
    var testLight = new BABYLON.HemisphericLight("testLight", new BABYLON.Vector3(0, 1, 0), scene);
    testLight.intensity = 5; // Intensität wieder hochgesetzt zum Testen

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Elemente erstellen
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Start-Panel
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "black";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.isPointerBlocker = true;
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    startUI_bg.isVisible = true;
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "auto"; // Höhe auf auto
    text1.paddingTop = "10px"; // Padding für Text
    text1.paddingBottom = "10px";
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";
    nonXRPanel.addControl(text1);

    // *** NEU: "Fertig"-Button erstellen (initial unsichtbar) ***
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    fertigButton.width = "150px";
    fertigButton.height = "40px";
    fertigButton.color = "white";
    fertigButton.background = "green";
    fertigButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    fertigButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    fertigButton.top = "-20px";
    fertigButton.isVisible = false; // Initial unsichtbar
    advancedTexture.addControl(fertigButton);

    // *** NEU: Click-Handler für den "Fertig"-Button ***
    fertigButton.onPointerClickObservable.add(() => {
        if (mode === 0) { // Nur ausführen, wenn wir noch im Create-Modus sind
            console.log("Fertig Button geklickt! Wechsle zu Modus 1.");
            mode = 1; // Modus auf MANIPULATE setzen
            fertigButton.isVisible = false; // Button wieder ausblenden
            if (defaultObject) {
                defaultObject.isVisible = false; // Reticle ausblenden
            }
            if (text1) {
                 text1.text = "Manipulationsmodus aktiv. Tippe, um die Farbe zu ändern.";
            }
        }
    });
    // ===========================================================

    // Funktion zur Erstellung des Standard-Objekts (Reticle)
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

    // *** Überarbeitete Funktion zur Manipulation ***
    function manipulateObject(obj) {
        if (obj && obj.scaling) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10); // Skalieren
             console.log("Objekt skaliert.");
             // *** NEU: Button sichtbar machen ***
             if (fertigButton && mode === 0) { // Button nur im Modus 0 sichtbar machen
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button sichtbar gemacht.");
                 if (text1) {
                     text1.text = "Objekt platziert und skaliert. Drücke 'Fertig'.";
                 }
             }
             // *** ENTFERNT: mode = 1; *** // Wird jetzt durch Button-Klick gesetzt
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt übergeben:", obj);
        }
    }

    // Text basierend auf AR-Verfügbarkeit setzen
    if (!arAvailable) {
        text1.text = "AR is not available in your system...";
        return scene;
    } else {
        text1.text = "Willkommen. Finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
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
        text1.text = "Error initializing XR. Please check console.";
        return scene;
    }

    // Start-UI in XR ausblenden/einblenden und Zustände zurücksetzen
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        startUI_bg.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        startUI_bg.isVisible = true;
        mode = 0; // Modus zurücksetzen
        if (fertigButton) fertigButton.isVisible = false; // Button ausblenden
        if(firstObject) {
            firstObject.dispose();
            firstObject = null;
        }
        text1.text = "Willkommen. Finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
    });

    const fm = xr.baseExperience.featuresManager;

    // Hit-Test-Feature aktivieren
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    if (!xrTest) {
        console.warn("WebXR Hit Test Feature ist nicht verfügbar.");
        text1.text = "Hit-Test Feature nicht verfügbar. Platzierung nicht möglich.";
    } else {
        // Hit-Test Ergebnisse verarbeiten
        xrTest.onHitTestResultObservable.add((results) => {
            if (results.length) {
                hitTest = results[0];
                hitTest.transformationMatrix.decompose(undefined, hitTestRotation, hitTestPosition);
                // Reticle nur anzeigen, wenn im CREATE-Modus (mode 0)
                if (defaultObject) {
                    // *** Reticle nur sichtbar wenn mode=0 UND Button unsichtbar ***
                    defaultObject.isVisible = (mode === 0 && !fertigButton.isVisible);
                    if(defaultObject.isVisible) { // Nur positionieren, wenn sichtbar
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

    // Controller Input verarbeiten (A-Taste etc.) - Unverändert
    if (xr && xr.baseExperience && xr.baseExperience.inputManager) {
        xr.baseExperience.inputManager.onControllerAddedObservable.add((inputSource) => {
            console.log("Controller verbunden:", inputSource.uniqueId);
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log("Motion Controller initialisiert:", motionController.profileId);
                // A-Taste Handler
                const aButtonComponent = motionController.getComponent("a-button");
                if (aButtonComponent) {
                    aButtonComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) {
                            console.log("A-Taste GEDRÜCKT!");
                            if (defaultObject && defaultObject.material) {
                                const mat = defaultObject.material as BABYLON.StandardMaterial;
                                if (mat.diffuseColor) {
                                    const originalColor = mat.diffuseColor.clone();
                                    const flashColor = new BABYLON.Color3(0, 1, 0); // Grün
                                    mat.diffuseColor = flashColor;
                                    setTimeout(() => {
                                        if (defaultObject && defaultObject.material) {
                                            (defaultObject.material as BABYLON.StandardMaterial).diffuseColor = originalColor;
                                        }
                                    }, 200);
                                }
                            } else {
                                console.warn("A-Taste: defaultObject oder Material nicht gefunden.");
                            }
                        } else {
                           console.log("A-Taste LOSGELASSEN!");
                        }
                    });
                }
                // Trigger Handler
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) console.log("Trigger GEDRÜCKT! Value:", component.value.toFixed(2));
                        else console.log("Trigger LOSGELASSEN!");
                    });
                }
                // Grip Handler
                const gripComponent = motionController.getComponent("xr-standard-squeeze");
                if (gripComponent) {
                    gripComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) console.log("Grip GEDRÜCKT! Value:", component.value.toFixed(2));
                        else console.log("Grip LOSGELASSEN!");
                    });
                }
            });
        });
        xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => {
            console.log("Controller entfernt:", inputSource.uniqueId);
        });
    } else {
        console.error("XR Experience oder Input Manager nicht initialisiert!");
    }

    // === Pointer Down Handler (Tippen auf Bildschirm/Oberfläche) ===
    scene.onPointerDown = (evt, pickInfo) => {
        // Grundvoraussetzungen: In XR und gültiger Hit-Test vorhanden?
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {

            // Modus 0: Objekt erstellen und skalieren, Button anzeigen
            if (mode === 0 && defaultObject && !fertigButton.isVisible) { // Nur ausführen, wenn Button noch nicht sichtbar ist
                 console.log("Pointer Down im Modus 0 (CREATE)");
                 // Nur ein Objekt erlauben (altes ggf. entfernen)
                 if (firstObject) {
                     firstObject.dispose();
                     firstObject = null;
                 }
                 // Klon erstellen vom Reticle
                 firstObject = defaultObject.clone("placedObject_" + Date.now());

                 if (firstObject) {
                     firstObject.position.copyFrom(hitTestPosition);
                     if (firstObject.rotationQuaternion) {
                         firstObject.rotationQuaternion.copyFrom(hitTestRotation);
                     }
                     firstObject.isVisible = true;
                     firstObject.isPickable = true;
                     // Neues Material, das auf Licht reagiert
                     let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                     placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Startfarbe Grün
                     firstObject.material = placedObjectMaterial;

                     // Objekt initial skalieren & Button anzeigen (ändert Modus NICHT)
                     manipulateObject(firstObject);

                 } else {
                     console.error("Klonen des Objekts fehlgeschlagen.");
                 }
            }
            // Modus 1: Platziertes Objekt manipulieren (Farbe ändern)
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                // Prüfen, ob bereits ein Objekt platziert wurde
                if (firstObject && firstObject.material) {
                     console.log("Ändere Farbe von firstObject");
                     // Farbe ändern (Beispiel: Rot) - Unverändert zu deinem Code
                     let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat_Mode1", scene); // Neuer Name für Material
                     placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
                     firstObject.material = placedObjectMaterial;
                     console.log("Objekt neu eingefärbt."); // Dein Log-Text
                } else {
                     console.warn("Modus 1: Kein platziertes Objekt (firstObject) zum Manipulieren gefunden.");
                }
            }
            // else { console.log("Pointer Down im Modus:", mode); }

        } else {
            // Klick ignorieren, wenn nicht in XR oder kein Hit-Test
            console.log("Pointer Down ignoriert (Nicht in XR oder kein Hit-Test). State:", xr?.baseExperience?.state, "HitTest:", !!hitTest);
        }
    }; // Ende scene.onPointerDown

    // Reticle initial erstellen
    createStandardObj();

    // Wichtig: Die erstellte Szene zurückgeben
    return scene;
}; // Ende createScene

// Event Listener für die Größenänderung des Fensters
window.addEventListener("resize", function () {
    if (engine) {
        engine.resize();
    }
});

// Szene starten
async function initializeApp() {
    try {
        console.log("Initialisiere App...");
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine konnte nicht erstellt werden');
        console.log("Engine erstellt.");

        scene = await createScene();
        if (!scene) throw new Error('Szene konnte nicht erstellt werden');
        console.log("Szene erstellt.");

        sceneToRender = scene;

        startRenderLoop(engine, canvas);
        console.log("Render Loop gestartet.");

    } catch (e) {
        console.error("Initialisierungsfehler:", e);
        // Zeige Fehler im UI an
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.padding = '10px';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.zIndex = "1000";
        errorDiv.textContent = 'FEHLER BEI INITIALISIERUNG: ' + e.message;
        document.body.appendChild(errorDiv);
    }
}

// App starten, wenn das DOM geladen ist
document.addEventListener("DOMContentLoaded", initializeApp);