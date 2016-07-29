//Wrapper for OIMO && Three.js
//  plus some other advanced functionality

//This is basically god.... a gemarian god. ;)
var gem = {
    settings: {},
    world: {},
    entities: {},
    entity_keys: [],
    internal_action_queue: [],
    GameLoop: function () { },      //User Sets this for Game Logic
    Setup: undefined,          //User Sets this for World Setup
    Create_World: function () {

        //Varies Default settings that can be changed.
        this.settings = {}
        this.settings.timestep = 1 / 60;                                //Time between each step
        this.settings.collision_algo = 2;                               // 1: BruteForceBroadPhase  2: (default)sweep and prune  3: dynamic bounding volume tree 
        this.settings.solver_iter = 8;                                  //Number of iterations for constraint solvers. 
        this.settings.calc_stats = false;                               //Should Oimo calc stats?
        this.settings.w = window.innerWidth - 4;
        this.settings.h = window.innerHeight - 4;

        //Oimo
        //  Anything pertaining to physics/collisions calc + Rigidbodies goes here.
        this.world = {}
        this.world.oimo_world = new OIMO.World(this.settings.timestep, this.settings.collision_algo, this.settings.solver_iter, this.settings.calc_stats);
        this.world.oimo_world.gravity = new OIMO.Vec3(0, -9.8, 0);      //Default Gravity
        this.world.oimo_world.worldscale(10);                           //determines scale of objects in world. It's large because ot gives better precision.

        //isRunning -: for Start() && Stop()
        //isUpdating -: Optimization for Internal_Game_Loop
        this.world.state = {isRunning: false, isUpdating: false};

        //Three.js
        //  --Either the user sets up the world like they want or 
        //      we go with the default one.
        //      We do this for the newer users.
        if (this.Setup == undefined){
            this.Helper.Setup();
            this.Helper.Light();
            this.Helper.Camera();
        }
        else
            this.Setup();

        //All entities in the world go here.
        //  This ranges from terrain, player, item, plant, anything.....
        //  An Entity contains:
        //      string      id 
        //      OIMO.Body   body
        //      THREE.Mesh  mesh
        //      function()  update
        //      state {update, entity_complex, ...} 
        //          
        this.entities = {};
        this.entity_keys = [];

        //Internal Action Queue to run after Update is processed for gameloop
        this.internal_action_queue = [];
    },//End Create()

    //Starts rendering, update loop, etc....
    Start: function () {
        gem.world.state.isRunning = true;
        gem.settings.interval = setInterval(gem.Internal_Game_Loop, gem.settings.timestep * 1000);
        gem.Internal_Render_Loop();
    },//End Start()

    //Stops rendering, update loop, etc...
    Stop: function () {
        clearInterval(gem.settings.interval);
        gem.world.state.isRunning = false;
    },//End Stop()

    //Re-initializes the world
    Reset: function () {
        if (gem.world.state.isRunning) gem.Stop();
        gem.Create();
    },//End Reset()

    //Freezes all Physics in the World
    Sleep: function () {
        for (var num in gem.entity_keys) {
            gem.entities[gem.entity_keys[num]].body.body.sleep();
        }
    },

    //Unfreezes all Physics in the world
    Awake: function () {
        for (var num in gem.entity_keys) {
            gem.entities[gem.entity_keys[num]].body.body.awake();
        }
    },

    //Internal Render call. Gem deals with all graphical render calls :D
    Internal_Render_Loop: function () {
        requestAnimationFrame(gem.Internal_Render_Loop);
        if (!gem.world.state.isRunning) return;
        gem.world.renderer.render(gem.world.scene, gem.world.camera);
    },//End Internal_Render_Loop()

    //Internal GameLoop
    Internal_Game_Loop: function () {
        if (!gem.world.state.isRunning) { return; }

        gem.world.oimo_world.step();

        //Standard Physics loop
        entity_count = gem.entity_keys.length;
        while (entity_count--) {
            if (gem.entities[gem.entity_keys[entity_count]] == undefined) continue;
            if (!gem.entities[gem.entity_keys[entity_count]].body.getSleep()) {
                var g = gem.entities[gem.entity_keys[entity_count]]
                g.mesh.position.copy(g.body.getPosition());
                g.mesh.quaternion.copy(g.body.getQuaternion());
            }//End if
        }//End while

        //Logic Dictated via the programmer
        gem.GameLoop();

        //Call the Update functions for every-single-entity
        //  Called after incase user mods an entity in gameloop
        gem.world.state.isUpdating = true;
        for (var num in gem.entity_keys) {
            if (gem.entities[gem.entity_keys[num]].state.update || !gem.entities[gem.entity_keys[num]].body.getSleep())
                gem.entities[gem.entity_keys[num]].Update(gem.entities[gem.entity_keys[num]]);
        }
        gem.world.state.isUpdating = false;

        //Process Internal Action work
        while (gem.internal_action_queue.length > 0)
            (gem.internal_action_queue.shift()).func();
    },//End Internal_Game_Loop()


    //Finishes the insertion into the World - DO NOT USE OUTSIDE GEM
    Internal_Simple_Add: function (id, oimo_opts, mesh, update_func) {
        oimo_opts.name = id;

        var temp_id = id;
        while (gem.entities[temp_id] != undefined) {
            temp_id += '_0';
        }


        var entity = {
            id: temp_id,
            body: new OIMO.Body(oimo_opts),         //Inserts Rigidbody
            mesh: mesh,
            state: { update: true, entity_complex: false },
            Update: function (me) {
                derp = update_func || function () { };
                derp(me);
                this.state.update = false;
            },
            Set_Position: function (x, y, z) {
                var pos = new OIMO.Vec3(x, y, z);
                this.body.setPosition(pos);
                this.body.body.updatePosition(gem.settings.timestep);
                this.state.update = true;
            },
            Set_Rotation: function (x, y, z) {
                var rot = new OIMO.Euler(x, y, z);
                this.body.setRotation(rot);
                this.body.body.updatePosition(gem.settings.timestep);
                this.state.update = true;
            },
            Set_Update: function (func) {
                this.update = function (me) {
                    derp = update_func || function () { };
                    derp(me);
                    this.state.update = false;
                }
            },
            Set_Material: function (mat) { this.mesh.material = mat;},
            Get_Material: function () { return this.mesh.material; },
            Get_Position: function () { return this.body.getPosition(); },
            Get_Quaternion: function () { return this.body.Get_Quaternion(); },
            Get_Euler: function () { return this.body.getEuler(); }
        };

        var size = oimo_opts.size || [10, 10, 10];
        var pos = oimo_opts.pos || [0, 0, 0];
        var rot = oimo_opts.rot || [0, 0, 0];

        entity.mesh.scale.set(size[0], size[1], size[2]);
        entity.mesh.position.set(pos[0], pos[1], pos[2]);
        entity.mesh.rotation.set(rot[0] * gem.Helper.ToRad, rot[1] * gem.Helper.ToRad, rot[2] * gem.Helper.ToRad);

        entity.mesh.castShadow = true;
        entity.mesh.receiveShadow = true;

        if (entity.body.body == undefined) { alert(entity.id + ": body is undefined"); return; }

        gem.entities[entity.id] = entity;         //Add entity to the list of world entities
        gem.world.scene.add(entity.mesh);
        gem.entity_keys.push(entity.id);
    },//End Internal_Add()


    //Adds a simple entity into the world
    //  Only to be used for an entity with a single rigid-body.
    //  id is string
    //  oimo_opts define the rigid-body created.
    //  mesh can also be custom or standard.
    //  update_func is the function called every-step
    Add_Simple_Entity: function (id, oimo_opts, mesh, update_func) {
        gem.internal_action_queue.push({ func: gem.Internal_Simple_Add.bind(undefined, id, oimo_opts, mesh, update_func) });
    },//End Add_Simple_Entity()


    //Internal Add Simple Joint
    Internal_Add_Simple_Joint: function (type, entity_1_id, entity_2_id, array_pos_1, array_pos_2, opt_container) {
        var en_1 = gem.entities[entity_1_id].body.body;
        var en_2 = gem.entities[entity_2_id].body.body;
        var pos_1 = array_pos_1 || [0, 0, 0];
        var pos_2 = array_pos_2 || [0, 0, 0];
        var t_type = type || 'joint';
        var opts = opt_container || {};

        //Map inputs
        opts.type = t_type;
        opts.body1 = en_1;
        opts.body2= en_2;
        opts.pos1 = pos_1;
        opts.pos2 = pos_2;
        opts.min = 1;
        opts.max = 2;
        opts.collision = true;

        //Queue up the work order
        gem.world.oimo_world.add(opts);
    },//End Internal_Add_Simple_Joint()

    //Takes 2 entities and joins them at the given local locations specified
    //  Entities can be pulled from gem.entities[string_id]
    //  array_pos_# is [x, y, z] local to the geometry
    //  opts_container:
    //      min, max - #    -   Joint distance from each other
    //      spring - [#, #] -   How soft the joint is
    //      motor - [#, #]  -   Something about a motor - line 12399 in oimo.js
    //      limit - [#, #]  -   Rotational limit
    //
    //  type options:
    //      'joint' 
    //      'jointDistance'     - uses opts: min, max, spring, motor
    //      'jointBall'
    //      'jointHinge'        - uses opts: min, max, spring, motor
    //      'jointPrisme'       - uses opts: min, max
    //      'jointSlide'        - uses opts: min, max
    //      'jointWheel'        - uses opts: min, max, spring, motor, limit
    Add_Simple_Joint: function (type, entity_1_id, entity_2_id, array_pos_1, array_pos_2, opt_container) {
        gem.internal_action_queue.push({ func: gem.Internal_Add_Simple_Joint.bind(undefined, type, entity_1_id, entity_2_id, array_pos_1, array_pos_2, opt_container) });
    },//End Add_Simple_Joint()


    //Creates and Adds a Complex Entity to the world.
    //  A complex entity has multiple Rigidbodies.
    //  IE: Terrain.
    //  Otherwise it's the same as AddSimpleEntity()
    //  oimo_opts = { {oimo_opts}, {oimo_opts}.. }
    //  loc = vector3 or location of the single mesh
    //Add_Complex_Entity: function (id, oimo_opts, mesh, update_func) {
    //    var entity = {
    //        id: id,
    //        body: {},
    //        mesh: mesh,
    //        state: { update: true, entity_complex: true },
    //        Update: function () { derp = update_func || function () { }; derp(); this.state.update = false; gem.world.state.update = false; },
    //        Set_Position: function (x, y, z, bods) {  //x,y,z are for mesh. bods is [ Vec3, Vec3.... ]
    //            var iter = 0;
    //            for (var bod in this.body) {
    //                if(bods[iter] != undefined) {
    //                    bod.setPosition(bods[iter]);
    //                }
    //                iter++;
    //            }

    //            this.mesh.position.copy(new OIMO.Vec3(x, y, z, 'XYZ'));
    //            this.state.update = true;
    //            gem.world.state.update = true;
    //        },
    //        Set_Rotation: function (x, y, z, bods) { //x,y,z are for mesh. bods is [ Euler, Euler.... ]
    //            var iter = 0;
    //            for (var bod in this.body) {
    //                if (bods[iter] != undefined)
    //                    bod.setRotation(bods[iter]);
    //                iter++;
    //            }

    //            this.mesh.rotation.set(x * V3D.ToRad, y * V3D.ToRad, z * V3D.ToRad);
    //            this.state.update = true;
    //            gem.world.state.update = true;
    //        },
    //        Set_Update: function (func) { this.Update = function () { derp = func || function () { }; derp(); this.state.update = false; gem.world.state.update = false; } },
    //        Get_Position: function () { return this.mesh.getWorldPosition(); },
    //        Get_Quaternion: function () { return this.mesh.GetWorldQuaternion(); },
    //        Get_Euler: function () { return this.mesh.getWorldEuler(); }
    //    };

    //    //Add in all of the rigidbodies
    //    for (var bod in oimo_opts) { body.push(new OIMO.Body(bod)); }

        
    //    gem.entities[id] = entity;                     //Add entity to the list of world entities
    //    gem.world.v3d.scene.add(mesh);                 //bypass v3d.add because mesh is custom made via user ; We don't want your shit meshes v3d.
    //},//End Add_Complex_Entity()

    //Internally queue up remove - DO NOT USE OUTSIDE GEM
    Internal_Remove: function (id) {
        var entity = gem.entities[id];
        if (entity.state.entity_complex) {
            for (var bod in entity.body) { gem.world.oimo_world.removeRigidBody(bod); }
            gem.world.scene.remove(entity.mesh);
        } else {
            gem.world.oimo_world.removeRigidBody(entity.body);
            gem.world.scene.remove(entity.mesh);
        }

        delete gem.entities[id];

        for (var i in gem.entity_keys) {
            if (gem.entity_keys[i] == undefined) continue;
            if (gem.entity_keys[i] == id) {
                delete gem.entity_keys[i];
                break;
            }//End for
        }//End for
    },//End Internal_Remove()

    //Remove the designated entity from the game
    //  Doesn't care if it's complex or simple.
    Remove_Entity: function (id) {
        gem.internal_action_queue.push({ func: gem.Internal_Remove.bind(undefined, id) });
    },//End Remove_Entity()

    //Helps with the creation of all possible oimo_opts
    //  
    //  SetPosition -: pos must be [x, y, z] where x,y,z := real-number
    //  SetRotation -: rot must be [x, y, z] where x,y,z := real-number in degrees; NOT RADIANS
    //  SetSize -: size must be [s, s, s] where x := integer ; possible it could be a real.
    //  Set-
    //      Density, Friction, & Restitution all take real-numbers.
    //
    Generate_Simple_Entity_Oimo_Opts: function (opts) {
        //Give user the option to custom build via code
        t_opts = opts || {};
        t_opts.world = gem.world.oimo_world;

        var oimo_opts = {
            opts: t_opts,
            type: {sphere: 'sphere', cylinder: 'cylinder', box: 'box'},
            CanMove: function (hmm) { this.opts.move = hmm || undefined; },
            CanSleep: function (hmm) { this.opts.sleep = hmm || undefined; },
            SetType: function (collider_type) { this.opts.type = collider_type; },
            SetPosition: function (pos) { this.opts.pos = pos; },
            SetRotation: function (rot) { this.opts.rot = rot; },
            SetSize: function (size) { this.opts.size = size; },
            SetDensity: function (den) { this.opts.config = [den, this.opts.config[1], this.opts.config[2], undefined, undefined] || [den, undefined, undefined, undefined, undefined]; },
            SetFriction: function (fric) { this.opts.config = [this.opts.config[0], fric, this.opts.config[2], undefined, undefined] || [undefined, fric, undefined, undefined, undefined]; },
            SetRestitution: function (rest) { this.opts.config = [this.opts.config[0], this.opts.config[1], rest, undefined, undefined] || [undefined, undefined, rest, undefined, undefined]; },
            SetMass: function (mass) { this.opts.massPos = mass; this.opts.massRot = mass; },
            GetOpts: function () { return this.opts; }
        };
        return oimo_opts;
    },//End Generate_Simple_Entity_Oimo_Opts()

    //--------------------------------------------------------------------------------------------
    // Creates general basic entities to simplify test scenes.
    //  Also support functionality for geometries because OIMO is weird and will only work will with specific sized
    //  geometries created.
    Shapes: {

        //Internal Shape creator... DON'T USE OUTSIDE GEM
        Internal_Create_Shape: function (id, pos_array, size_array, rot_array, opt_material, opt_body_opts, shape_type) {
            var core_shape = {};

            //For all shapes:
            core_shape.id = id || '';
            core_shape.pos = pos_array || [0, 0, 0];
            core_shape.size = size_array || [1, 1, 1];
            core_shape.rot = rot_array || [0, 0, 0];

            core_shape.body = gem.Generate_Simple_Entity_Oimo_Opts(opt_body_opts);
            core_shape.body.SetSize(core_shape.size);
            core_shape.body.SetPosition(core_shape.pos);
            core_shape.body.SetRotation(core_shape.rot);

            //Pretty Obvious
            if (shape_type == 'box') {
                core_shape.body.SetType(core_shape.body.type.box);
                var mat = opt_material || new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 50});
                var core_shape_geo = new THREE.BufferGeometry().fromGeometry(new THREE.BoxGeometry(1, 1, 1));
                core_shape.mesh = new THREE.Mesh(core_shape_geo, mat);
            } else if (shape_type == 'sphere') {
                core_shape.body.SetType(core_shape.body.type.sphere);
                var mat = opt_material || new THREE.MeshPhongMaterial({ color: 0x3f6b3b });
                var core_shape_geo = new THREE.BufferGeometry().fromGeometry(new THREE.SphereGeometry(1, 32, 32));
                core_shape.mesh = new THREE.Mesh(core_shape_geo, mat);
            } else if (shape_type == 'cylinder') {
                core_shape.body.SetType(core_shape.body.type.cylinder);
                var mat = opt_material || new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 50 });
                var core_shape_geo = new THREE.BufferGeometry().fromGeometry(new THREE.CylinderGeometry(1, 1, 1, 12, 1));
                core_shape.mesh = new THREE.Mesh(core_shape_geo, mat);
            } else if (shape_type == 'plane') {
                var mat = opt_material || new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 50 });
                var core_shape_geo = new THREE.PlaneBufferGeometry(1.0, 1.0);
                core_shape_geo.applyMatrix(new THREE.Matrix4().makeRotationX(-90 * gem.Helper.ToRad))
                core_shape.mesh = new THREE.Mesh(core_shape_geo, mat);
            }

            return core_shape;
        },//End Internal_Create_Shape()


        //Creates a static box - all parameters are optional
        Create_Static_Box: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var box = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'box');
            box.body.CanMove(false);

            gem.Add_Simple_Entity(box.id, box.body.GetOpts(), box.mesh, opt_update_func);
        },//End Create_Static_Box()

        //creates a dynamic box - all parameters are optional
        Create_Dynamic_Box: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var box = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'box');
            box.body.CanMove(true);

            gem.Add_Simple_Entity(box.id, box.body.GetOpts(), box.mesh, opt_update_func);
        },//End Create_Dynamic_Box()

        //Creates a static sphere - all parameters are optional
        Create_Static_Sphere: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var sph = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'sphere');
            sph.body.CanMove(false);

            gem.Add_Simple_Entity(sph.id, sph.body.GetOpts(), sph.mesh, opt_update_func);
        },//End Create_Static_Sphere()

        //Creates a dynamic sphere - all parameters are optional
        Create_Dynamic_Sphere: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var sph = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'sphere');
            sph.body.CanMove(true);

            gem.Add_Simple_Entity(sph.id, sph.body.GetOpts(), sph.mesh, opt_update_func);
        },//End Create_Dynamic_Sphere()

        //Creates a static cylinder - all parameters are optional
        Create_Static_Cylinder: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var cyl = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'cylinder');
            cyl.body.CanMove(false);

            gem.Add_Simple_Entity(cyl.id, cyl.body.GetOpts(), cyl.mesh, opt_update_func);
        },//End Create_Static_Cylinder()

        //Creates a dynamic cylinder - all parameters are optional
        Create_Dynamic_Cylinder: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var cyl = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'cylinder');
            cyl.body.CanMove(true);

            gem.Add_Simple_Entity(cyl.id, cyl.body.GetOpts(), cyl.mesh, opt_update_func);
        },//End Create_Dynamic_Cylinder()

        //Creates a static plane - all parameters are optional
        Create_Static_Plane: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var pla = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'plane');
            pla.body.CanMove(false);

            gem.Add_Simple_Entity(pla.id, pla.body.GetOpts(), pla.mesh, opt_update_func);
        },//End Create_Static_Plane()

        //Creates a dynamic plane - all parameters are optional
        Create_Dynamic_Plane: function (id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, opt_update_func) {
            var pla = gem.Shapes.Internal_Create_Shape(id, pos_array, size_array, rot_array, opt_mat, opt_body_opts, 'plane');
            pla.body.CanMove(false);

            gem.Add_Simple_Entity(pla.id, pla.body.GetOpts(), pla.mesh, opt_update_func);
        }//End Create_Dynamic_Plane()

    },//End Shapes


    //-----------------------------------------------------------------------------------
    //Creates General Meshes and Materials
    
    //Used for General Materials Control
    Materials: {
        Internal_Create_Material: function (materials_opts, type) {
            if (type == 'phong')
                return new THREE.MeshPhongMaterial(materials_opts);
            else if (type == 'lambert')
                return new THREE.MeshLambertMaterial(materials_opts);
            else
                return undefined;
        },//End Internal_Create_Materials(0
        Create_Phong_Material: function (material_opts) {
            return gem.Materials.Internal_Create_Material(material_opts, 'phong');
        },//End Create_Phong_Material()
        Create_Lambert_Material: function (material_opts) {
            return gem.Materials.Internal_Create_Material(material_opts, 'lambert')
        },//End Create_Lambert_Material()
        Generate_Material_Opts: function () {
            var mat_opts = {
                opts: {},
                Set_Name: function (name) { this.opts.name = name || ""; },
                Set_Transparent: function (bool) { this.opts.transparent = true; },
                Set_Opacity: function (float) { this.opts.opacity = float || 1.0; this.opts.transparent = true; },
                Set_Blending: function (three_blend_const) { this.opts.blending = three_blend_const || THREE.NormalBlending; },
                Set_Visible: function (bool) { this.opts.visible = bool || true; },
                Set_Update: function (bool) { this.opts.needsUpdate = bool || false; },
                Set_Diffuse_Texture: function (texture) { this.opts.map = texture || null; },
                Set_Normal_Texture: function (texture, three_vector2_normal_scale) { this.opts.normalMap = texture || undefined; this.opts.normalScale = normal_scale_opt || THREE.Vector2(1.0, 1.0); },
                Set_Specular_Texture: function (texture) { this.opts.specularMap = texture || null; },
                Set_Emissive_Texture: function (texture) { this.opts.emissiveMap = texture || null; },
                Set_Alpha_Texture: function (texture) { this.opts.alphaMap = texture || null; },
                Set_Shininess: function (int) { this.opts.shininess = int || 30; },
                Set_Color: function (hex_color) { this.opts.color = hex_color || 0xdddddd; },
                Set_Emissive_Color: function (hex_color) { this.opts.emissive = hex_color || 0x000000 },
                Set_Emissive_Intensity: function (float) { this.opts.emissiveIntensity = float || 0.5 },
                Set_Reflectivity: function (int) { this.opts.reflectivity = int || 1; },
                Set_Specular_Color: function (hex_color) { this.opts.specular = hex_color || 0x111111; },
                Set_Fog: function (bool) { this.opts.fog = bool || true; },
                Set_Wireframe: function (bool) {this.opts.wireframe = bool || true; },
                GetOpts: function () { return this.opts; }
            };
            return mat_opts;
        }//End Generate_Material_Opts()
    },//End Materials


    //Used for General Mesh control
    Mesh: {

    },//End Mesh


    //Used just to load in textures which we'll then throw into the materials
    Texture: {
        Load_Tiled_Texture: function (file_path_string, repeat_u, repeat_v) {
            var u = repeat_u || 6;
            var v = repeat_v || 6;

            var loader = new THREE.TextureLoader();
            loader.crossOrigin = '';
            var mat = loader.load(file_path_string);

            mat.wrapS = THREE.RepeatWrapping;
            mat.wrapT = THREE.RepeatWrapping;
            mat.repeat.set(u, v);
            mat.anisotropy = 4;
            return mat;
        },//End Load_Tiled_Texture;
        Load_General_Texture: function (file_path_string) {
            var loader = new THREE.TextureLoader();
            loader.crossOrigin = '';
            return loader.load(file_path_string);
        }//End Load_General
    },//End Texture

    //Migrating a lot of v3D functionality to here.
    //  V3D only really exists to give a user a lot of default functionality
    //  so they don't have to keep re-creating the wheel.
    Helper: {
        //Conversion Constants
        ToRad: Math.PI / 180,
        ToDeg: 180 / Math.PI,

        //Creates a general Light
        Light: function () {
            var hemiLight = new THREE.HemisphereLight(0xffffff, 0x303030, 0.3);
            gem.world.scene.add(hemiLight);
            var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
            dirLight.position.set(0.5, 1, 0.5).normalize();
            gem.world.scene.add(dirLight);
        },//End Light()

        //Default Setup if the Setup func isn't specified
        Setup: function () {
            gem.world.clock = new THREE.Clock();

            gem.world.scene = new THREE.Scene();

            gem.world.renderer = new THREE.WebGLRenderer({ precision: "mediump", antialias: true });
            gem.world.renderer.setSize(gem.settings.w, gem.settings.h);
            gem.world.renderer.setClearColor(0x1d1f20);

            //Default Background
            var gradTexture = function (color) {
                var c = document.createElement("canvas");
                var ct = c.getContext("2d");
                c.width = 16; c.height = 128;
                var gradient = ct.createLinearGradient(0, 0, 0, 128);
                var i = color[0].length;
                while (i--) { gradient.addColorStop(color[0][i], color[1][i]); }
                ct.fillStyle = gradient;
                ct.fillRect(0, 0, 16, 128);
                var tx = new THREE.Texture(c);
                tx.needsUpdate = true;
                return tx;
            };

            var buffgeoBack = new THREE.BufferGeometry();
            buffgeoBack.fromGeometry(new THREE.IcosahedronGeometry(1000, 1));
            var back = new THREE.Mesh(buffgeoBack, new THREE.MeshBasicMaterial({ map: gradTexture([[0.75, 0.6, 0.4, 0.25], ['#1B1D1E', '#3D4143', '#72797D', '#b0babf']]), side: THREE.BackSide, depthWrite: false, fog: false }));
            back.geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(15 * gem.Helper.ToRad));
            gem.world.scene.add(back);
            gem.world.renderer.autoClear = false;

            gem.world.container = document.getElementById('container');
            gem.world.container.appendChild(gem.world.renderer.domElement);
        },//End Setup()

        Camera: function () {
            gem.world.camera = new THREE.PerspectiveCamera(60, gem.settings.w / gem.settings.h, 0.1, 10000);

            gem.world.Navigation = function (root) {
                this.parent = root;
                this.camPos = { h: 90, v: 60, distance: 400, automove: false };
                this.mouse = { x: 0, y: 0, ox: 0, oy: 0, h: 0, v: 0, mx: 0, my: 0, down: false, over: false, moving: true, button: 0 };
                this.vsize = { w: this.parent.w, h: this.parent.h };
                this.center = { x: 0, y: 0, z: 0 };
                this.key = [0, 0, 0, 0, 0, 0, 0];
                this.rayTest = null;

                var _this = this;
                // disable context menu
                document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, false);

                this.parent.container.addEventListener('mousemove', function (e) { _this.onMouseMove(e) }, false);
                this.parent.container.addEventListener('mousedown', function (e) { _this.onMouseDown(e) }, false);
                this.parent.container.addEventListener('mouseout', function (e) { _this.onMouseUp(e) }, false);
                this.parent.container.addEventListener('mouseup', function (e) { _this.onMouseUp(e) }, false);

                if (typeof window.ontouchstart !== 'undefined') {
                    this.parent.container.addEventListener('touchstart', function (e) { _this.onMouseDown(e) }, false);
                    this.parent.container.addEventListener('touchend', function (e) { _this.onMouseUp(e) }, false);
                    this.parent.container.addEventListener('touchmove', function (e) { _this.onMouseMove(e) }, false);
                }

                this.parent.container.addEventListener('mousewheel', function (e) { _this.onMouseWheel(e) }, false);
                this.parent.container.addEventListener('DOMMouseScroll', function (e) { _this.onMouseWheel(e) }, false);
                window.addEventListener('resize', function (e) { _this.onWindowResize(e) }, false);
            }
            gem.world.Navigation.prototype = {
                constructor: gem.world.Navigation,
                initCamera: function (h, v, d) {
                    this.camPos.h = h || 90;
                    this.camPos.v = v || 60;
                    this.camPos.distance = d || 400;
                    this.moveCamera();
                },
                moveCamera: function () {
                    this.parent.camera.position.copy(this.Orbit(this.center, this.camPos.h, this.camPos.v, this.camPos.distance));
                    this.parent.camera.lookAt(this.center);
                },
                Orbit: function (origine, h, v, distance) {
                    origine = origine || new THREE.Vector3();
                    var p = new THREE.Vector3();
                    var phi = v * gem.Helper.ToRad;
                    var theta = h * gem.Helper.ToRad;
                    p.x = (distance * Math.sin(phi) * Math.cos(theta)) + origine.x;
                    p.z = (distance * Math.sin(phi) * Math.sin(theta)) + origine.z;
                    p.y = (distance * Math.cos(phi)) + origine.y;
                    return p;
                },
                unwrapDegrees: function (r) {
                    r = r % 360;
                    if (r > 180) r -= 360;
                    if (r < -180) r += 360;
                    return r;
                },
                initEvents: function () {
                    var _this = this;
                    // disable context menu
                    document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, false);

                    this.parent.container.addEventListener('mousemove', function (e) { _this.onMouseMove(e) }, false);
                    this.parent.container.addEventListener('mousedown', function (e) { _this.onMouseDown(e) }, false);
                    this.parent.container.addEventListener('mouseout', function (e) { _this.onMouseUp(e) }, false);
                    this.parent.container.addEventListener('mouseup', function (e) { _this.onMouseUp(e) }, false);

                    if (typeof window.ontouchstart !== 'undefined') {
                        this.parent.container.addEventListener('touchstart', function (e) { _this.onMouseDown(e) }, false);
                        this.parent.container.addEventListener('touchend', function (e) { _this.onMouseUp(e) }, false);
                        this.parent.container.addEventListener('touchmove', function (e) { _this.onMouseMove(e) }, false);
                    }

                    this.parent.container.addEventListener('mousewheel', function (e) { _this.onMouseWheel(e) }, false);
                    this.parent.container.addEventListener('DOMMouseScroll', function (e) { _this.onMouseWheel(e) }, false);
                    window.addEventListener('resize', function (e) { _this.onWindowResize(e) }, false);
                },
                onMouseRay: function (x, y) {
                    this.mouse.mx = (this.mouse.x / this.vsize.w) * 2 - 1;
                    this.mouse.my = -(this.mouse.y / this.vsize.h) * 2 + 1;
                    this.rayTest();
                },
                onMouseMove: function (e) {
                    e.preventDefault();
                    var px, py;
                    if (e.touches) {
                        this.mouse.x = e.clientX || e.touches[0].pageX;
                        this.mouse.y = e.clientY || e.touches[0].pageY;
                    } else {
                        this.mouse.x = e.clientX;
                        this.mouse.y = e.clientY;
                    }
                    if (this.rayTest !== null) this.onMouseRay();
                    if (this.mouse.down) {
                        document.body.style.cursor = 'move';
                        this.camPos.h = ((this.mouse.x - this.mouse.ox) * 0.3) + this.mouse.h;
                        this.camPos.v = (-(this.mouse.y - this.mouse.oy) * 0.3) + this.mouse.v;
                        this.moveCamera();
                    }
                },
                onMouseDown: function (e) {
                    e.preventDefault();
                    var px, py;
                    if (e.touches) {
                        px = e.clientX || e.touches[0].pageX;
                        py = e.clientY || e.touches[0].pageY;
                    } else {
                        px = e.clientX;
                        py = e.clientY;
                        // 0: default  1: left  2: middle  3: right
                        this.mouse.button = e.which;
                    }
                    this.mouse.ox = px;
                    this.mouse.oy = py;
                    this.mouse.h = this.camPos.h;
                    this.mouse.v = this.camPos.v;
                    this.mouse.down = true;
                    if (this.rayTest !== null) this.onMouseRay(px, py);
                },
                onMouseUp: function (e) {
                    this.mouse.down = false;
                    document.body.style.cursor = 'auto';
                },
                onMouseWheel: function (e) {
                    var delta = 0;
                    if (e.wheelDeltaY) { delta = e.wheelDeltaY * 0.01; }
                    else if (e.wheelDelta) { delta = e.wheelDelta * 0.05; }
                    else if (e.detail) { delta = -e.detail * 1.0; }
                    this.camPos.distance -= (delta * 10);
                    this.moveCamera();
                },
                onWindowResize: function () {
                    this.vsize.w = window.innerWidth - 4;
                    this.vsize.h = window.innerHeight - 4;
                    this.parent.camera.aspect = this.vsize.w / this.vsize.h;
                    this.parent.camera.updateProjectionMatrix();
                    this.parent.renderer.setSize(this.vsize.w, this.vsize.h);
                }
            }//End camera.Navigation

            gem.world.nav = new gem.world.Navigation(gem.world);
            gem.world.nav.initCamera();
        }//End Camera()

    }//End Helper

}//End Gem