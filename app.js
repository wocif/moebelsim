// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene; // Globale Szene-Variable, wird in initializeApp gesetzt

let mode = 0;

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
    let fertigButton = null; // *** NEU: Variable hinzugefügt ***
    // =======================================

    // Kamera erstellen -> FreeCamera für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1; // Setzt die Layer-Maske der Kamera
    camera.attachControl(canvas, true); // Kamera an das Canvas binden

    // Lichtquellen erstellen
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene); // Position angepasst
    light.intensity = 1.7; // Intensität angepasst
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene); // Position angepasst
    light2.intensity = 1.5; // Intensität angepasst

    var testLight = new BABYLON.HemisphericLight("testLight", new BABYLON.Vector3(0, 1, 0), scene);
    testLight.intensity = 5; // Dein Wert

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
    startUI_bg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER; // Deine Zentrierung
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel"); // Name geändert
    startUI_bg.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "auto"; // Deine Höhe
    text1.paddingTop = "10px"; // Deine Paddings
    text1.paddingBottom = "10px";
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";
    nonXRPanel.addControl(text1); // Text zum Panel hinzufügen

    // *** NEU: "Fertig"-Button erstellen (initial unsichtbar) ***
    fertigButton = BABYLON.GUI.Button.CreateSimpleButton("fertigBtn", "Fertig");
    fertigButton.width = "150px";
    fertigButton.height = "40px";
    fertigButton.color = "white";
    fertigButton.background = "green";
    fertigButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM; // Positionierung
    fertigButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    fertigButton.top = "-20px";
    fertigButton.isVisible = false; // Initial unsichtbar
    advancedTexture.addControl(fertigButton); // Zur Textur hinzufügen

    // *** NEU: Click-Handler für den "Fertig"-Button ***
    fertigButton.onPointerClickObservable.add(() => {
        // Nur ausführen, wenn der Button sichtbar ist
        if (fertigButton.isVisible) {
            console.log("Fertig Button geklickt! Setze mode = 1.");
            mode = 1; // Setze den Modus auf 1
            fertigButton.isVisible = false; // Blende den Button wieder aus
            // Optional: Reticle ausblenden, wenn Modus wechselt
            if (defaultObject) {
                defaultObject.isVisible = false;
            }
        }
    });
    // ===========================================================

    // Funktion zur Erstellung des Standard-Objekts (Reticle), jetzt *innerhalb* von createScene
    function createStandardObj() {
        if (!defaultObject) {
            // Verwende die *lokale* 'scene' Variable
            defaultObject = BABYLON.MeshBuilder.CreateBox("standardBox", { width: 0.2, height: 0.1, depth: 0.05, updatable: true }, scene); // Größe angepasst
            let standardObjMaterial = new BABYLON.StandardMaterial("reticleMaterial", scene);
            standardObjMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1);
            standardObjMaterial.roughness = 1;
            standardObjMaterial.disableLighting = true; // Oft sinnvoll für Reticles
            standardObjMaterial.backFaceCulling = false;

            defaultObject.material = standardObjMaterial;
            defaultObject.renderingGroupId = 1;
            defaultObject.isVisible = false; // Unsichtbar bis erster Hit-Test
            defaultObject.isPickable = false;

            if (!defaultObject.rotationQuaternion) {
                defaultObject.rotationQuaternion = BABYLON.Quaternion.Identity();
            }
        }
    }

    // *** START DER ÄNDERUNG an manipulateObject ***
    // Funktion zur Manipulation des platzierten Objekts, jetzt *innerhalb* von createScene
    function manipulateObject(obj) {
        if (obj && obj.scaling) { // Prüfen ob obj und scaling existieren
             // Korrigiert: Verwende die 'scaling' Eigenschaft
             // Annahme: Originalgröße war die des Reticles (0.2, 0.1, 0.05)
             // Skaliere es z.B. auf das 10-fache
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             console.log("Objekt skaliert."); // Dein Log

             // *** NEU: Mache den Button sichtbar ***
             if (fertigButton) { // Stelle sicher, dass der Button existiert
                 fertigButton.isVisible = true;
                 console.log("Fertig-Button sichtbar gemacht.");
             }

             // *** ENTFERNT: mode = 1; *** // Diese Zeile wurde entfernt
        } else {
            console.warn("ManipulateObject: Ungültiges Objekt übergeben:", obj);
        }
    }
    // *** ENDE DER ÄNDERUNG an manipulateObject ***

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

    // Hide Start GUI in XR und Reset
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        startUI_bg.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        startUI_bg.isVisible = true;
        // *** NEU: Button beim Verlassen von XR ausblenden ***
        if (fertigButton) {
            fertigButton.isVisible = false;
        }
        // *** Ende Neu ***
        mode = 0; // Modus zurücksetzen
        if (firstObject) { // Platziertes Objekt entfernen
            firstObject.dispose();
            firstObject = null;
        }
        text1.text = "Willkommen. Möbel-Simulator 0.1 by Tom. Tippe auf den Bildschirm, um ein Objekt zu platzieren."; // Text zurücksetzen
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

                // *** Reticle Sichtbarkeit angepasst ***
                if (defaultObject) { // Prüfen ob Reticle existiert
                    // Reticle nur sichtbar, wenn mode=0 UND der Fertig-Button NICHT sichtbar ist
                    // Prüfen ob fertigButton existiert, bevor auf isVisible zugegriffen wird
                    defaultObject.isVisible = (mode === 0 && fertigButton && !fertigButton.isVisible);
                    if (defaultObject.isVisible) { // Nur positionieren, wenn sichtbar
                        defaultObject.position.copyFrom(hitTestPosition);
                        if (defaultObject.rotationQuaternion) { // Sicherstellen, dass Quaternion existiert
                             defaultObject.rotationQuaternion.copyFrom(hitTestRotation);
                        }
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

    // Überprüfen, ob XR und die Input-Verwaltung verfügbar sind
    if (xr && xr.baseExperience && xr.baseExperience.inputManager) {
        xr.baseExperience.inputManager.onControllerAddedObservable.add((inputSource) => {
            console.log("Controller verbunden:", inputSource.uniqueId);
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log("Motion Controller initialisiert für:", inputSource.uniqueId, "Profil:", motionController.profileId);
                const aButtonComponent = motionController.getComponent("a-button");
                if (aButtonComponent) {
                    console.log("A-Button Komponente gefunden.");
                    aButtonComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) {
                            console.log("A-Taste GEDRÜCKT!");
                            if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) {
                                const originalColor = defaultObject.material.diffuseColor.clone();
                                const flashColor = new BABYLON.Color3(0, 1, 0);
                                defaultObject.material.diffuseColor = flashColor;
                                setTimeout(() => {
                                    if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) {
                                        defaultObject.material.diffuseColor = originalColor;
                                    }
                                }, 200);
                            } else { console.warn("Konnte Farbe von defaultObject nicht ändern."); }
                        } else { console.log("A-Taste LOSGELASSEN!"); }
                    });
                } else { console.warn("Keine A-Button Komponente auf diesem Controller gefunden."); }
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                    console.log("Trigger Komponente gefunden.");
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        console.log(`Trigger Zustand: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        if (component.pressed) console.log("Trigger GEDRÜCKT!");
                        else console.log("Trigger LOSGELASSEN!");
                    });
                } else { console.warn("Keine Trigger Komponente auf diesem Controller gefunden."); }
                const gripComponent = motionController.getComponent("xr-standard-squeeze");
                if (gripComponent) {
                    console.log("Grip Komponente gefunden.");
                    gripComponent.onButtonStateChangedObservable.add((component) => {
                        console.log(`Grip Zustand: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        if (component.pressed) console.log("Grip GEDRÜCKT!");
                        else console.log("Grip LOSGELASSEN!");
                    });
                } else { console.warn("Keine Grip Komponente auf diesem Controller gefunden."); }
            });
        });
        xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => {
            console.log("Controller entfernt:", inputSource.uniqueId);
        });
    } else {
        console.error("XR Experience oder Input Manager nicht initialisiert!");
    }

    // Pointer Down Handler
    scene.onPointerDown = (evt, pickInfo) => {
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {
            // Modus 0: Objekt erstellen, nur wenn Button NICHT sichtbar ist
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
                     placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Grün
                     firstObject.material = placedObjectMaterial; // Licht reagierendes Material
                     manipulateObject(firstObject); // Skalieren & Button anzeigen
                 } else { console.error("Klonen des Objekts fehlgeschlagen."); }
            }
            // Modus 1: Objekt manipulieren (Farbe ändern)
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                if (firstObject && firstObject.material) {
                    // Dein Code zum Ändern der Farbe
                    let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat_Mode1", scene); // Eigener Name
                    placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // z.B. Rot
                    firstObject.material = placedObjectMaterial;
                    console.log("Objekt neu eingefärbt."); // Dein Log
                } else { console.warn("Modus 1: Kein platziertes Objekt/Material gefunden."); }
            }
        } else {
            console.log("Pointer Down ignoriert. Bedingungen: inXR=", xr?.baseExperience?.state === BABYLON.WebXRState.IN_XR, "hitTest=", !!hitTest);
        }
    }; // Ende scene.onPointerDown

    // Reticle initial erstellen
    createStandardObj();

    // Wichtig: Die erstellte *lokale* Szene zurückgeben
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
        engine = createDefaultEngine();
        if (!engine) throw new Error('Engine could not be created');
        scene = await createScene();
        if (!scene) throw new Error('Scene could not be created');
        sceneToRender = scene;
        startRenderLoop(engine, canvas);
    } catch (e) {
        console.error("Initialization failed:", e);
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