
var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine deklaration
var scene = null; // Babylon 3D scene deklaration
var sceneToRender = null;

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        //hier soll sichergegestellt werden, dass die Szene existiert und eine Kamera hat
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

//Erstellung der BabylonJS-Engine mit bestimmten Einstellungen
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true, //erhält den Zeichenpuffer
        stencil: true, //aktiviert den Stencil-Puffer für Effekte
        disableWebGL2Support: false //WebGL2-Unterstützung aktivieren
    });
};

const createScene = async function () {
    //Zuerst BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine);

    //Kamera erstellen -> FreeCamera verwendet für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.layerMask = 1;
    //durch attachControl() wird die Kamera an das Canvas gebunden
    camera.attachControl(canvas, true);

    //Lichtquelle erstellen -> HemisphericLight für gleichmäßige Beleuchtung
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1000, 5), scene);
    light.intensity = 0.2;

    //Lichtquelle erstellen -> PointLight für punktuelle Lichtquelle
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 1000, 5), scene);
    light2.intensity = 0.1;



    


    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black"; //Hintergrundfarbe
    rectangle.color = "green"; //Randfarbe
    rectangle.width = "80%"; //Breite
    rectangle.height = "50%"; //Höhe

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");
    advancedTexture.addControl(rectangle);

    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);






    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica"; //Schriftart
    text1.textWrapping = true; //erlaubt zeilenumbruch
    text1.color = "white"; //Textfarbe
    text1.fontSize = "14px"; //Schriftgröße
    text1.height = "400px"; //Höhe
    text1.paddingLeft = "10px"; //linker Rand
    text1.paddingRight = "10px"; //rechter Rand

    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please use a supported device (e.g., Meta Quest 3 or modern Android) and browser (e.g., Chrome).";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "Willkommen. Hole dir ein virtuelles Fenster zu einer virtuellen Welt in dein Zuhause. Platziere es entweder an Stelle eines echten vorhandenen Fensters oder stattdessen an Stelle einer Tür, um in die virtuelle Realität gänzlich abzutauchen. Vergewissere dich immer, ob es sicher ist, dich zu bewegen! Wir übernehmen keine Haftung. Mai Phuong Nguyen, Tom Schmidt, Informatik in Kultur und Gesundheit, Wintersemester 2024/25 HTW Berlin";
        nonXRPanel.addControl(text1);
    }


    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar", //start AR-Session im immersiven Modus
            referenceSpaceType: "local-floor", //benutzt den Boden als Referent für AR-Objekte
            onError: (error) => {
                alert(error);
            }
        },
        optionalFeatures: true //optionale features aktivieren falls verfügbar
    });


    const fm = xr.baseExperience.featuresManager;

    //Aktiviert das Hit-Test-Feature
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");

    //Zugriff auf die XR-Kamera
    const xrCamera = xr.baseExperience.camera;


    
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, rotation, position);
        } else {
            hitTest = undefined;
        }
    });

    function createReticle() {
        if (!reticleMesh) {
            reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", {width: 1, height: 0.5}, scene);
            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            reticleMat.backFaceCulling = false; //deaktiviert das "Verstecken der Rückseite" für die Rückseite des reticles
            reticleMesh.material = textMaterial_Reticle;//reticleMat;
            reticleMesh.renderingGroupId = 2; 
            reticleMesh.isVisible = false; //nicht sichtbar bis zur ersten Interaktion
            reticleMesh.rotationQuaternion = BABYLON.Quaternion.Identity(); //default-Rotation
            reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1); //standard größe

        }
    }


}

window.addEventListener("resize", function () {
    engine.resize(); //passt engine an fenstergrößen an
});