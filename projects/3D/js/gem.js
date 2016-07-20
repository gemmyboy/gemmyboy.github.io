//Wrapper for OIMO && Three.js && v3d.js

//This is basically god.... a gemarian god. ;)
var gem = {
    settings: {},
    world: {},
    entities: {},
    entity_keys: [],
    GameLoop: function() {},
    Create: function () {

        //Varies Default settings that can be changed.
        this.settings = {}
        this.settings.timestep = 1 / 60;                                //Time between each step
        this.settings.collision_algo = 2;                               // 1: BruteForceBroadPhase  2: (default)sweep and prune  3: dynamic bounding volume tree 
        this.settings.solver_iter = 8;                                  //Number of iterations for constraint solvers. 
        this.settings.calc_stats = false;                               //Should Oimo calc stats?

        //Oimo
        //  Anything pertaining to physics/collisions calc + Rigidbodies goes here.
        this.world = {}
        this.world.oimo_world = new OIMO.World(this.settings.timestep, this.settings.collision_algo, this.settings.solver_iter, this.settings.calc_stats);
        this.world.oimo_world.gravity = new OIMO.Vec3(0, -9.8, 0);      //Default Gravity
        this.world.oimo_world.worldscale(10);                           //determines scale of objects in world. It's large because ot gives better precision.

        //running -: for Start() && Stop()
        //update -: Optimization for Internal_Game_Loop
        this.world.state = {running: false, update: false};

        //Three.js & v3d.js
        //  v3d.js is really just used to simplify the usage of Three.js
        //  Anything pertaining to the Mesh & Material goes here.
        this.world.v3d = new V3D.View();

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
    },//End Create()

    //Starts rendering, update loop, etc....
    Start: function () {
        gem.world.state.running = true;
        gem.settings.interval = setInterval(gem.Internal_Game_Loop, gem.settings.timestep * 1000);
        gem.Internal_Render_Loop();
    },//End Start()

    //Stops rendering, update loop, etc...
    Stop: function () {
        clearInterval(gem.settings.interval);
        gem.world.state.running = false;
    },//End Stop()

    //Re-initializes the world
    Reset: function () {
        if (gem.world.state.running) gem.Stop();
        gem.Create();
    },//End Reset()

    //Internal Render call. Gem deals with all graphical render calls :D
    Internal_Render_Loop: function () {
        requestAnimationFrame(gem.Internal_Render_Loop);
        if (!gem.world.state.running) {
            return;
        }
        gem.world.v3d.render();
    },//End Internal_Render_Loop()

    //Internal GameLoop
    Internal_Game_Loop: function () {
        if (!gem.world.state.running) { return; }

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

        gem.GameLoop();

        ////Call the Update functions for every-single-entity
        ////  Called after incase user mods an entity in gameloop
        //if(gem.world.state.update)//Optimization
        //    for (var num in gem.entity_keys) {
        //        if (gem.entities[gem.entity_keys[num]].state.update)
        //            gem.entities[gem.entity_keys[num]].Update();
        //    }
    },//End Internal_Game_Loop()

    //Adds a simple entity into the world
    //  Only to be used for an entity with a single rigid-body.
    //  id is string
    //  oimo_opts define the rigid-body created.
    //  mesh can also be custom or standard.
    //  update_func is the function called every-step
    Add_Simple_Entity: function (id, oimo_opts, mesh, update_func) {
        var entity = {
            id: id,
            body: new OIMO.Body(oimo_opts),         //Inserts Rigidbody
            mesh: mesh,
            state: { update: true, entity_complex: false },
            Update: function () { derp = update_func || function () { }; derp(); this.state.update = false; gem.world.state.update = false;},
            Set_Position: function (x, y, z) {
                var pos = new OIMO.Vec3(x, y, z);
                this.body.setPosition(pos);
                this.body.body.updatePosition(gem.settings.timestep);
                this.state.update = true;
                gem.world.state.update = true;
            },
            Set_Rotation: function (x, y, z) {
                var rot = new OIMO.Euler(x, y, z);
                this.body.setRotation(rot);
                this.body.body.updatePosition(gem.settings.timestep);
                this.state.update = true;
                gem.world.state.update = true;
            },
            Set_Update: function (func) { this.update = function () { derp = update_func || function () { }; derp(); this.state.update = false; gem.world.state.update = false; } },
            Get_Position: function () { return this.body.getPosition(); },
            Get_Quaternion: function () { return this.body.Get_Quaternion(); },
            Get_Euler: function () { return this.body.getEuler(); }
        };

        var size = oimo_opts.size || [10, 10, 10];
        var pos = oimo_opts.pos || [0, 0, 0];
        var rot = oimo_opts.rot || [0, 0, 0];

        entity.mesh.scale.set(size[0], size[1], size[2]);
        entity.mesh.position.set(pos[0], pos[1], pos[2]);
        entity.mesh.rotation.set(rot[0] * V3D.ToRad, rot[1] * V3D.ToRad, rot[2] * V3D.ToRad);

        if (entity.body.body == undefined) { alert(entity.id + ": body is undefined"); return;}

        gem.entities[id] = entity;         //Add entity to the list of world entities
        gem.world.v3d.scene.add(mesh);     //bypass v3d.add because mesh is custom made via user ; We don't want your shit meshes v3d.
        gem.entity_keys.push(id);
    },//End Add_Simple_Entity()

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

    //Remove the designated entity from the game
    //  Doesn't care if it's complex or simple.
    Remove_Entity: function (id) {
        var entity = gem.entities[id];
        if (entity.state.entity_complex == false) {
            for (var bod in entity.body) { gem.world.oimo_world.removeRigidBody(bod); }
            gem.world.v3d.scene.remove(entity.mesh);
        } else {
            gem.world.oimo_world.removeRigidBody(entity.body);
            gem.world.v3d.scene.remove(entity.mesh);
        }
        console.log('Removing: ' + id);

        delete gem.entities[id];

        for (var i in gem.entity_keys) {
            if (gem.entity_keys[entity_count] == undefined) continue;
            if(gem.entity_keys[i] == id) {
                delete gem.entity_keys[i];
                break;
            }//End for
        }//End for
    },//End Remove_Entity()

    //Helps with the creation of all possible oimo_opts
    //  
    //  SetPosition -: pos must be [x, y, z] where x,y,z := real-number
    //  SetRotation -: rot must be [x, y, z] where x,y,z := real-number in degrees; NOT RADIANS
    //  SetSize -: size must be [s, s, s] where x := integer ; possible it could be a real.
    //  Set-
    //      Density, Friction, & Restitution all take real-numbers.
    //
    Generate_Simple_Entity_Oimo_Opts: function () {
        var oimo_opts = {
            opts: {world: gem.world.oimo_world},
            type: {sphere: 'sphere', cylinder: 'cylinder', box: 'box'},
            CanMove: function (hmm) { this.opts.move = hmm || undefined; },
            CanSleep: function (hmm) { this.opts.sleep = hmm || undefined; },
            SetType: function (type) { this.opts.type = type; },
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

    //Creates a general Light
    Light: function() { gem.world.v3d.initLight(); }
}//End GameEngine.prototype




























