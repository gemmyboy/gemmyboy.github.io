/*
    GJK-Extension for Oimo.js
        by Marcus Shannon
    
    Here I'll be implementing the Algorithm GJK and then pulling that into Oimo.js ;

    Also needed will be a culling algorithm to generate a Convex-Hull given a set of vertices.
*/


//Implementation Specific
var Gjk = {
    simplex: [],
    direction: Vec3(0, 1, 0),

    //What's called to check actual Collision
    detectCollision: function (shape1, shape2) {
        var initial_s = Support(shape1, shape2, new Vec3(0, 1, 0));
        this.simplex = [initial_s];  //Initial Point
        this.direction = initial_s.negate();

        while (true) {
            var a = Support(shape1, shape2, this.direction);
            if (Dot(a, this.direction) < 0) return false;
            else this.simplex.add(a);    //Add new Point

            if (DoSimplex()) return true;   //Removes a Point depending on circumstance
        }//End while
    },//End detectCollision()
    DoSimplex: function () {
        var a = this.simplex[this.simplex.length - 1];
        var ao = a.negate();

        if (this.simplex.length == 3) {
            var b = this.simplex[this.simplex.length - 2];
            var c = this.simplex[this.simplex.length - 3];

            var ab_p = TripleCross(ac, ab, ab);
            var ac_p = TripleCross(ab, ac, ac);

            if (Dot(ab_p, ao) > 0) { this.simplex.splice(this.simplex.length - 3); this.direction = ab_p; }
            else { if (Dot(ac_p, ao) > 0) {this.simplex.splice(this.simplex.length - 2);this.direction(ac_p);} else return true;}
        } else {
            var b = this.simplex[this.simplex.length - 2];
            var ab = b.subtract(a);
            this.direction(TripleCross(ab, ao, ab));
        }
        return false;
    },//End DoSimplex()
    Support: function (shape1, shape2, direction) {
        var p1 = shape1.getFarthestPoint(direction);
        var p2 = shape2.getFarthestPoint(direction);
        return p1.subtract(p2);
    }//End Support()
};


//Vec3 additions
var getFarthestPoint = function (vec3_direction) {
    this.verts = [];    //Load in vertices here

    var index = vert.length-1;
    var distance = Dot(vert[verts.length-1], vec3_direction);
    var size = verts.length-1;
    
    //Better performance and you have to iter through entire array regardless
    while(size--) {
        var tmp = Dot(verts[size], vec3_direction)
        if (tmp > distance) {
            distance = tmp;
            index = size;
        }//End if
    }//End while
    return verts[index]
};



//Support Functions - These are likely already in Oimo.js hence I'm throwing these at the bottom for the moment
var negate = function () { return new Vec3(this.x * -1, this.y * -1, this.z * -1); };
var subtract = function (vec3_1) { return new Vec3(this.x - vec3_1.x, this.y - vec3_1.y, this.z - vec3_1.z); }

var Dot = function (vec3_1, vec3_2) { return (vec3_1.x * vec3_1.y * vec3_1.z) + (vec3_2.x * vec3_2.y * vec3_2.z); };
var TripleCross = function (vec3_1, vec3_2, vec3_3) { return Dot(vec3_2, Dot(vec3_1, vec3_3)) - Dot(vec3_3, Dot(vec3_1, vec3_2)); };