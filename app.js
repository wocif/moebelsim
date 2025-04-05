// Grundlegende Variablen-Deklarationen
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var sceneToRender = null; // Szene, die gerendert werden soll
var scene; // Globale Szene-Variable, wird in initializeApp gesetzt

let mode = 0; // 0 = CREATE Mode, 1 = MANIPULATE Mode

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
    let firstObject = null; // Das erste/aktuell platzierte Objekt
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
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene);
    light.intensity = 1.7;
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 5, -5), scene);
    light2.intensity = 1.5;
    var testLight = new BABYLON.HemisphericLight("testLight", new BABYLON.Vector3(0, 1, 0), scene); // Zusätzliches Licht für Helligkeit
    testLight.intensity = 1; // Intensität etwas reduziert

    // Prüfen, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Elemente erstellen
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const startUI_bg = new BABYLON.GUI.Rectangle("startRect");
    startUI_bg.background = "black";
    startUI_bg.color = "green";
    startUI_bg.width = "80%";
    startUI_bg.height = "50%";
    startUI_bg.isPointerBlocker = true;
    startUI_bg.isVisible = true;
    advancedTexture.addControl(startUI_bg);

    const nonXRPanel = new BABYLON.GUI.StackPanel("nonXRPanel");
    startUI_bg.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "auto"; // Höhe auf automatisch setzen, passt sich dem Text an
    text1.paddingTop = "10px";
    text1.paddingBottom = "10px";
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";
    nonXRPanel.addControl(text1);

    // Funktion zur Erstellung des Standard-Objekts (Reticle)
    function createStandardObj() {
        if (!defaultObject) {
            defaultObject = BABYLON.MeshBuilder.CreateBox("standardBox", { width: 0.2, height: 0.1, depth: 0.05, updatable: true }, scene);
            let standardObjMaterial = new BABYLON.StandardMaterial("reticleMaterial", scene);
            standardObjMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1); // Blau-Lila
            standardObjMaterial.roughness = 1;
            standardObjMaterial.disableLighting = true; // Ignoriert Licht
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

    // Funktion zur ersten Manipulation des platzierten Objekts (Skalierung + Moduswechsel)
    function initialManipulateObject(obj) {
        if (obj && obj.scaling) {
             obj.scaling = new BABYLON.Vector3(10, 10, 10); // Skalieren
             mode = 1; // Modus auf MANIPULATE setzen
             console.log("Objekt skaliert. Modus ist jetzt:", mode);
             text1.text = "Objekt platziert. Tippe erneut, um die Farbe zu ändern. Drücke A für Reticle-Farbe."; // UI Text aktualisieren
        } else {
            console.warn("InitialManipulateObject: Ungültiges Objekt übergeben:", obj);
        }
    }

    // Text basierend auf AR-Verfügbarkeit setzen
    if (!arAvailable) {
        text1.text = "AR wird auf diesem Gerät/Browser nicht unterstützt.";
        return scene;
    } else {
        text1.text = "Willkommen! Finde eine Oberfläche und tippe, um ein Objekt zu platzieren.";
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
        text1.text = "Fehler bei der XR-Initialisierung.";
        return scene;
    }

    // Start-UI in XR ausblenden/einblenden
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        startUI_bg.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        startUI_bg.isVisible = true;
        mode = 0; // Modus zurücksetzen beim Verlassen von XR
        if(firstObject) {
            firstObject.dispose(); // Platziertes Objekt entfernen
            firstObject = null;
        }
        text1.text = "Willkommen! Finde eine Oberfläche und tippe, um ein Objekt zu platzieren."; // Text zurücksetzen
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

                if (defaultObject && mode === 0) { // Reticle nur im CREATE-Modus anzeigen
                    defaultObject.isVisible = true;
                    defaultObject.position.copyFrom(hitTestPosition);
                    if (defaultObject.rotationQuaternion) {
                         defaultObject.rotationQuaternion.copyFrom(hitTestRotation);
                    }
                } else if (defaultObject) {
                     defaultObject.isVisible = false; // Reticle im MANIPULATE-Modus ausblenden
                }
            } else {
                hitTest = undefined;
                if (defaultObject) {
                    defaultObject.isVisible = false;
                }
            }
        });
    }

    // Controller Input verarbeiten
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
                            // Reticle-Farbe ändern
                            if (defaultObject && defaultObject.material) {
                                const mat = defaultObject.material as BABYLON.StandardMaterial; // Type Assertion
                                if (mat.diffuseColor) {
                                    const originalColor = mat.diffuseColor.clone();
                                    const flashColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random()); // Zufällige Farbe
                                    mat.diffuseColor = flashColor;
                                    setTimeout(() => {
                                        if (defaultObject && defaultObject.material) { // Erneuter Check
                                            (defaultObject.material as BABYLON.StandardMaterial).diffuseColor = originalColor;
                                        }
                                    }, 200);
                                }
                            } else {
                                console.warn("A-Taste: defaultObject oder Material nicht gefunden.");
                            }
                        }
                    });
                } // Ende A-Button Handler

                // Trigger Handler (optional, für zukünftige Aktionen)
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed) {
                            console.log("Trigger GEDRÜCKT! Value:", component.value.toFixed(2));
                            // Hier könnte z.B. der PointerDown ausgelöst werden, wenn man nicht tippen will
                            // scene.simulatePointerDown(pickInfo, { pointerId: ... }); // Komplexer
                        }
                    });
                } // Ende Trigger Handler

            }); // Ende onMotionControllerInitObservable
        }); // Ende onControllerAddedObservable
    } else {
        console.error("XR Experience oder Input Manager nicht initialisiert!");
    }

    // === Pointer Down Handler (Tippen auf Bildschirm/Oberfläche) ===
    scene.onPointerDown = (evt, pickInfo) => {
        // Grundvoraussetzungen: In XR und gültiger Hit-Test vorhanden?
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest) {

            // Modus 0: Objekt erstellen
            if (mode === 0 && defaultObject) { // Sicherstellen, dass Reticle existiert
                 console.log("Pointer Down im Modus 0 (CREATE)");

                 // Nur ein Objekt erlauben (altes ggf. entfernen)
                 if (firstObject) {
                     firstObject.dispose();
                     firstObject = null;
                     console.log("Altes firstObject entfernt.");
                 }

                 // Klon erstellen vom Reticle
                 firstObject = defaultObject.clone("placedObject_" + Date.now());

                 if (firstObject) {
                     // Position und Rotation vom Hit-Test übernehmen
                     firstObject.position.copyFrom(hitTestPosition);
                     if (firstObject.rotationQuaternion) {
                         firstObject.rotationQuaternion.copyFrom(hitTestRotation);
                     }

                     // Sichtbar machen, Interaktion erlauben
                     firstObject.isVisible = true;
                     firstObject.isPickable = true;

                     // *** Wichtig: Neues Material erstellen, das auf Licht reagiert! ***
                     let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                     placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Startfarbe Grün
                     // Standardmäßig ist disableLighting = false, also reagiert es auf Licht
                     firstObject.material = placedObjectMaterial;

                     // Objekt initial skalieren und Modus wechseln
                     initialManipulateObject(firstObject);

                     // Optional: Reticle ausblenden nach Platzierung
                     if (defaultObject) defaultObject.isVisible = false;

                 } else {
                     console.error("Klonen des Objekts fehlgeschlagen.");
                 }
            }
            // Modus 1: Platziertes Objekt manipulieren (Farbe ändern)
            else if (mode === 1) {
                console.log("Pointer Down im Modus 1 (MANIPULATE)");
                // Prüfen, ob das platzierte Objekt (firstObject) getroffen wurde
                // ODER einfach immer das firstObject ändern, wenn im Modus 1 geklickt wird (einfacher für Start)
                if (firstObject && firstObject.material) {
                     console.log("Ändere Farbe von firstObject");
                     // Beispiel: Farbe zufällig ändern
                     (firstObject.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(
                         Math.random(),
                         Math.random(),
                         Math.random()
                     );
                } else {
                    console.warn("Modus 1: Kein platziertes Objekt (firstObject) zum Manipulieren gefunden.");
                }

                 // Alternativ: Prüfen, ob das platzierte Objekt gepickt wurde
                 // if (pickInfo && pickInfo.hit && pickInfo.pickedMesh === firstObject) {
                 //    console.log("firstObject wurde direkt angeklickt im Modus 1");
                 //    (firstObject.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(1,0,0); // Rot
                 // } else {
                 //    console.log("Klick im Modus 1, aber nicht auf firstObject.");
                 // }
            }
             // else { console.log("Pointer Down im Modus:", mode); }

        } else {
            console.log("Pointer Down ignoriert (Nicht in XR oder kein Hit-Test). State:", xr.baseExperience.state, "HitTest:", hitTest);
        }
    }; // Ende scene.onPointerDown

    // Reticle initial erstellen
    createStandardObj();

    // Wichtig: Die erstellte Szene zurückgeben
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
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; // Leicht transparentes Rot
        errorDiv.style.color = 'white';
        errorDiv.style.zIndex = "1000"; // Über Canvas legen
        errorDiv.textContent = 'FEHLER BEI INITIALISIERUNG: ' + e.message;
        document.body.appendChild(errorDiv);
    }
}

// App starten, wenn das DOM geladen ist
document.addEventListener("DOMContentLoaded", initializeApp);