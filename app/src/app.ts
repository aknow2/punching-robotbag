import { Axis, BallAndSocketConstraint, Color3, CreatePlane, Engine, FreeCamera, HavokPlugin, HemisphericLight, Light, Mesh, MeshBuilder, PBRMaterial, PhysicsAggregate, PhysicsBody, PhysicsHelper, PhysicsMotionType, PhysicsShapeBox, PhysicsShapeType, PointLight, Quaternion, Scene, SceneLoader, Space,StandardMaterial, TransformNode, Vector3, VertexData, WebXRInputSource } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok'
import havokWasmUrl from '../public/HavokPhysics.wasm?url'
import '@babylonjs/loaders/glTF'

async function getInitializedHavok() {
  console.log('getInitializedHavok', havokWasmUrl)
  return await HavokPhysics({
    locateFile: () => havokWasmUrl,
  });
}

let physicsHelper: PhysicsHelper | undefined

const createWall = (scene: Scene, width: number, height: number) => {
    const wall = new Mesh("wall", scene);
    const positions = [];
    const indices = [];
    const depth = 0.5; // 壁の奥行き
    // 壁の幅と高さを小さな単位で区切り、それぞれの単位に頂点を配置します
    for (var w = 0; w <= width; w++) {
        for (var h = 0; h <= height; h++) {
            // 頂点の座標をランダムにずらして不規則性を出します
            var x = w + (Math.random() - 0.5) * 0.3;
            var y = h + (Math.random() - 0.5) * 0.3;
            var z = (Math.random() - 0.5) * depth;

            positions.push(x, y, z);
        }
    }
    // 三角形を作成します
    for (var w = 0; w < width; w++) {
        for (var h = 0; h < height; h++) {
            var lowerLeft = w * (height + 1) + h;
            var lowerRight = (w + 1) * (height + 1) + h;
            var topLeft = lowerLeft + 1;
            var topRight = lowerRight + 1;

            indices.push(lowerLeft, lowerRight, topLeft);
            indices.push(topRight, topLeft, lowerRight);
        }
    }
    var vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(wall);

    return wall
}


const prepareSceneSettings = async (scene: Scene) => {
  console.log('prepare settings')
    const  gravityVector = new Vector3(0, -9.81, 0);
    const hkInjection = await getInitializedHavok();
    const hk = new HavokPlugin(true, hkInjection)
    scene.enablePhysics(gravityVector, hk)
    physicsHelper = new PhysicsHelper(scene)

    // camera
    const camera = new FreeCamera('camera', new Vector3(0, 1.2, -2), scene);
    scene.getEngine().getRenderingCanvas();

    // lighting
    const envLight = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    envLight.intensity = 0.8;
    const size = 20
    const height = 5

    // ground
    const groundMat = new PBRMaterial('groundMat', scene)
    groundMat.metallic = 0.7;
    groundMat.roughness = 0.2;
    groundMat.albedoColor = new Color3(0.1, 0.1, 0.1);

    const ground = MeshBuilder.CreateGround("ground", { width: size, height: size}, scene);
    ground.position.y = 0
    ground.material = groundMat
    const groundShape = new PhysicsShapeBox(
      new Vector3(0, 0, 0),
      Quaternion.Identity(),
      new Vector3(20, 0.1, 20),
      scene
    );
    const groundBody = new PhysicsBody(
        ground,
        PhysicsMotionType.STATIC,
        false,
        scene
    );
    const groundMaterial = { friction: 0.2, restitution: 0.3 };

    groundShape.material = groundMaterial;
    groundBody.shape = groundShape;
    groundBody.setMassProperties({
        centerOfMass: new Vector3(0, 0, 0),
        mass: 0,
        inertia: new Vector3(1, 1, 1),
        inertiaOrientation: Quaternion.Identity(),
    });
    ground.metadata = {
        shape: groundShape,
    };


    // create walls
    const zpWall = createWall(scene, size + 1, height)
    zpWall.position.z = size / 2
    zpWall.position.y = -0.5
    zpWall.position.x = -size / 2

    const znWall = zpWall.clone('znWall')
    znWall.position.z = -size / 2
    znWall.position.y = -0.5
    znWall.position.x = size / 2
    znWall.rotate(Axis.Y, Math.PI, Space.WORLD);

    const xpWall = zpWall.clone('xpWall')
    xpWall.position.z = size / 2
    xpWall.position.y = -0.5
    xpWall.position.x = size / 2
    xpWall.rotate(Axis.Y, Math.PI/2, Space.WORLD);

    const xnWall = zpWall.clone('xnWall')
    xnWall.position.z = -size / 2
    xnWall.position.y = -0.5
    xnWall.position.x = -size / 2
    xnWall.rotate(Axis.Y, -Math.PI/2, Space.WORLD);

    const ceiling = CreatePlane('ceiling', { size: size + 1 }, scene)
    const ceilingMat = new StandardMaterial('ceilingMat', scene)
    ceilingMat.diffuseColor = new Color3(1, 1, 1); // 白色に設定
    ceilingMat.backFaceCulling = true
    ceiling.material = ceilingMat;
    ceiling.position.y = height - 0.6
    ceiling.rotate(Axis.X, -Math.PI/2, Space.WORLD);
    const corners = [
        new Vector3(0, height, 0),
    ];

    const center = new Vector3(0, height, 0);
    for (let i = 0; i < corners.length; i++) {
        const direction = center.subtract(corners[i]);
        const light = new PointLight("dirLight", direction, scene);
        light.intensity = 1;
        light.range = size
        light.radius = size
        light.falloffType = Light.FALLOFF_PHYSICAL
        light.diffuse = new Color3(0, 0.5, 0.5);
    }

    return {
      hk,
      ground,
    }
}

const createSandbagBody = async (scene: Scene) => {
  const container = await SceneLoader.LoadAssetContainerAsync('./', `doll.glb`, scene)
  container.addAllToScene()
  
  const mesh = container.meshes[0]

  const mat = new StandardMaterial("material");
  mesh.material = mat

  var root = new TransformNode('root_doll');
  mesh.parent = root
  const agg = new PhysicsAggregate(
    root,
    PhysicsShapeType.CAPSULE,
    {
      mass: 0.1,
      radius: 0.47,
      pointA: new Vector3(0, 0.57, 0),
      pointB: new Vector3(0, -0.4, 0),
    },
    scene
  )



  const centerOfMass = new Vector3(0, -1.5,0)

  agg.body.setMassProperties({
    centerOfMass,
    mass: 1,
  })


  return {
    agg,
  }
}

const createSandbagStand = (scene: Scene) => {
  var stand = new TransformNode(`stand_node`);
  const agg = new PhysicsAggregate(
    stand,
    PhysicsShapeType.BOX,
    {
      mass: 0,
    },
    scene
  )

  return {
    agg
  }
}

const createGlove = async (scene: Scene, hk: HavokPlugin, type: 'left' | 'right') => {
  const container = await SceneLoader.LoadAssetContainerAsync('./', `glove.glb`, scene)
  const mesh = container.meshes[0]

  container.addAllToScene()
  mesh.scaling = new Vector3(0.7, 0.7, 0.7)

  var root = new TransformNode(`root_${type}_glove`);
  root.position.y = 100
  mesh.parent = root

  const agg = new PhysicsAggregate(
    root,
    PhysicsShapeType.SPHERE,
    {
      mass: 0,
      radius: 0.14,
    },
    scene
  )

  const syncGlove = (controller: WebXRInputSource) => {
    const { grip } = controller

    if (!grip) {
      return
    }

    const { rotationQuaternion, position } = grip

    // rotate
    if (rotationQuaternion) {
      const rot = rotationQuaternion.toEulerAngles()
      mesh.rotationQuaternion = Quaternion.RotationYawPitchRoll(rot.y, rot.x + 0.6, rot.z )
    }
    // translate
    const bodyId = agg.body._pluginData.hpBodyId
    hk._hknp.HP_Body_SetPosition(bodyId, [position.x, position.y, position.z])
  }
  return {
    agg,
    mesh,
    syncGlove,
  }
}

const createSandbag = async (scene: Scene, getController: (type: 'left'|'right') => WebXRInputSource | undefined) => {
  const sandbagBody = await createSandbagBody(scene)
  const stand = createSandbagStand(scene)

  // connect sandbag to stand
  const joint = new BallAndSocketConstraint(
    new Vector3(0, 0.1, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 1, 0),
    scene,
  )
  stand.agg.body.addConstraint(sandbagBody.agg.body, joint)

  sandbagBody.agg.body.setCollisionCallbackEnabled(true)
  sandbagBody.agg.body.getCollisionObservable().add((collider) => {
    console.log('collision', collider.collidedAgainst)

    const getType = (id: string) => {
      if (id === 'root_left_glove') {
        return 'left'
      }
      if (id === 'root_right_glove') {
        return 'right'
      }
      return undefined
    }
    const type = getType(collider.collidedAgainst.transformNode.id)
    if (!type) {
      return
    }
    const controller = getController(type)
    if (controller) {
      controller.motionController?.pulse(0.5, 50)
    }
  })
}

const runApp = async (canvas: HTMLCanvasElement) => {
  const engine = new Engine(canvas)
  const scene = new Scene(engine)
  const { hk }  = await prepareSceneSettings(scene)

  const leftGlove = await createGlove(scene, hk, 'left')
  const rightGlove = await createGlove(scene, hk, 'right')
  let leftController: WebXRInputSource | undefined
  let rightController: WebXRInputSource | undefined

  const getController = (type: 'left' | 'right') => {
    switch (type) {
      case 'left':
        return leftController
      case 'right':
        return rightController
    }
  }
  await createSandbag(scene, getController)
  const env = scene.createDefaultEnvironment();
  if (env && env.ground) {
    console.log('init xr', env.ground.name)
    const xr = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [env.ground],
      inputOptions: {
        doNotLoadControllerMeshes: true,
      }
    })
    xr.input.onControllerAddedObservable.add((controller) => {
      console.log('controller added', controller.grip, controller.inputSource)
      if(controller.inputSource.handedness === 'left') {
        leftController = controller
      }
      if(controller.inputSource.handedness === 'right') {
        rightController = controller
      }
    })
  }

  engine.runRenderLoop(function () {
    if (scene) {
      if (leftController) {
        leftGlove.syncGlove(leftController)
      }
      if (rightController) {
        rightGlove.syncGlove(rightController)
      }
      scene.render();
    }
  });
}

export default runApp
