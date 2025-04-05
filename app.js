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
    testLight.intensity = 1;

    

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

    // Funktion zur Manipulation des platzierten Objekts, jetzt *innerhalb* von createScene
    function manipulateObject(obj) {
        if (obj && obj.scaling) { // Prüfen ob obj und scaling existieren
             // Korrigiert: Verwende die 'scaling' Eigenschaft
             // Annahme: Originalgröße war die des Reticles (0.2, 0.1, 0.05)
             // Skaliere es z.B. auf das 10-fache
             obj.scaling = new BABYLON.Vector3(10, 10, 10);
             mode = 1;
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

    // Überprüfen, ob XR und die Input-Verwaltung verfügbar sind
    if (xr && xr.baseExperience && xr.baseExperience.inputManager) {

        // Wird ausgelöst, wenn ein Controller verbunden wird (beim Start der XR-Session oder wenn er eingeschaltet wird)
        xr.baseExperience.inputManager.onControllerAddedObservable.add((inputSource) => {
            console.log("Controller verbunden:", inputSource.uniqueId);

            // Hole den Motion Controller
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                console.log("Motion Controller initialisiert für:", inputSource.uniqueId, "Profil:", motionController.profileId);

                // --- Beispiel: A-Taste (oft auf dem rechten Controller) ---
                const aButtonComponent = motionController.getComponent("a-button"); // ID für A-Taste
                if (aButtonComponent) {
                    console.log("A-Button Komponente gefunden.");
                    aButtonComponent.onButtonStateChangedObservable.add((component) => {
                        // 'component' ist hier wieder die aButtonComponent
                        // component.pressed -> true, wenn gedrückt, false, wenn losgelassen
                        // component.value   -> 0 oder 1 für Buttons, 0 bis 1 für Trigger/Achsen
                        if (component.pressed) {
                            console.log("A-Taste GEDRÜCKT!");
    
                            // --- ANFANG: Ersetze hiermit die scene.clearColor Zeilen ---
                            if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) { // Prüfe ob Objekt, Material und Farbe existieren
                                const originalColor = defaultObject.material.diffuseColor.clone(); // Wichtig: Klonen, um Referenzprobleme zu vermeiden
                                const flashColor = new BABYLON.Color3(0, 1, 0); // Farbe für den Blitz (z.B. Grün)
    
                                // Farbe ändern
                                defaultObject.material.diffuseColor = flashColor;
                                // Optional: Log zur Bestätigung
                                // console.log("defaultObject Farbe geändert zu", flashColor);
    
                                // Timeout zum Zurücksetzen der Farbe
                                setTimeout(() => {
                                    // Erneute Prüfung im Timeout, falls sich Objekt/Material geändert hat
                                    if (defaultObject && defaultObject.material && defaultObject.material.diffuseColor) {
                                        defaultObject.material.diffuseColor = originalColor; // Zurück zur Originalfarbe
                                         // Optional: Log zur Bestätigung
                                         // console.log("defaultObject Farbe zurückgesetzt zu", originalColor);
                                    }
                                }, 200); // Dauer des Farbwechsels in Millisekunden (z.B. 200ms)
    
                            } else {
                                console.warn("Konnte Farbe von defaultObject nicht ändern. Objekt oder Material/diffuseColor fehlt?");
                            }
                            // --- ENDE: Ersetzung ---
    
                        } else {
                            console.log("A-Taste LOSGELASSEN!");
                            // Deine Aktion hier, wenn A losgelassen wird (bleibt unverändert)
                        }
                    });
                } else {
                    console.warn("Keine A-Button Komponente auf diesem Controller gefunden.");
                }

                // --- Beispiel: Trigger ---
                const triggerComponent = motionController.getComponent("xr-standard-trigger"); // ID für Trigger
                if (triggerComponent) {
                    console.log("Trigger Komponente gefunden.");
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        // Bei Triggern ist auch component.value interessant (0.0 bis 1.0)
                        console.log(`Trigger Zustand geändert: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        if (component.pressed) { // Äquivalent zu value > threshold (oft 0.1 oder so)
                            console.log("Trigger GEDRÜCKT!");
                            // Aktion für Trigger-Druck
                        } else {
                            console.log("Trigger LOSGELASSEN!");
                        }
                    });
                } else {
                    console.warn("Keine Trigger Komponente auf diesem Controller gefunden.");
                }

                // --- Beispiel: Grip (Seitentaste) ---
                const gripComponent = motionController.getComponent("xr-standard-squeeze"); // ID für Grip/Squeeze
                if (gripComponent) {
                    console.log("Grip Komponente gefunden.");
                    gripComponent.onButtonStateChangedObservable.add((component) => {
                        console.log(`Grip Zustand geändert: Pressed=${component.pressed}, Value=${component.value.toFixed(2)}`);
                        if (component.pressed) {
                            console.log("Grip GEDRÜCKT!");
                            // Aktion für Grip-Druck
                        } else {
                            console.log("Grip LOSGELASSEN!");
                        }
                    });
                } else {
                    console.warn("Keine Grip Komponente auf diesem Controller gefunden.");
                }

                // --- Finde ALLE Komponenten heraus ---
                // motionController.getComponentIds().forEach(id => {
                //     console.log("Verfügbare Komponenten-ID:", id);
                //     const comp = motionController.getComponent(id);
                //     // Hier könntest du für jede Komponente einen Listener hinzufügen oder Zustände abfragen
                // });

            }); // Ende onMotionControllerInitObservable
        }); // Ende onControllerAddedObservable

        // Optional: Listener für das Entfernen von Controllern
        xr.baseExperience.inputManager.onControllerRemovedObservable.add((inputSource) => {
            console.log("Controller entfernt:", inputSource.uniqueId);
            // Hier könntest du ggf. Aufräumarbeiten machen, falls nötig
        });

    } else {
        console.error("XR Experience oder Input Manager nicht initialisiert!");
    }

    // CREATE Objects, MODE = 0 = CREATE, 1 = MANIPULATE
    scene.onPointerDown = (evt, pickInfo) => {
        // Prüfen ob wir in XR sind und ein gültiger Hit-Test vorliegt
        // Verwende die *lokale* Variable 'xr' und 'hitTest'
        if (mode == 0 && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest && defaultObject) {

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
                 let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                placedObjectMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // z.B. Rot zum Testen
                // Stelle sicher, dass dieses Material Licht nutzt (Standard)
                firstObject.material = placedObjectMaterial;

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
             if (mode == 1 && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && hitTest && defaultObject) {

                // Klon erstellen vom *Reticle* (defaultObject)
                // Weist das Ergebnis der *lokalen* Variable 'firstObject' zu
                let placedObjectMaterial = new BABYLON.StandardMaterial("placedMat", scene);
                placedObjectMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // z.B. Rot zum Testen
                // Stelle sicher, dass dieses Material Licht nutzt (Standard)
                firstObject.material = placedObjectMaterial;
   
   
                } else {
                    console.error("fehlgeschlagen.");
                }
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