/// <reference path="typings/threejs/three.d.ts"/>
/*! Reticulum - v1.0.7 - 2015-08-11
 * http://gqpbj.github.io/examples/basic.html
 *
 * Copyright (c) 2015 Godfrey Q;
 * Licensed under the MIT license */

var Reticulum = (function () {
    var INTERSECTED = null;
    
    var collisionList = [];
    var raycaster;
    var vector;
    var clock;
    var reticle = {};

    var frustum;
    var cameraViewProjectionMatrix;
    
    //Settings from user
    var settings = {
        camera:             null, //Required
        gazingDuration:     2.5,
        proximity:          false
    };
    
    //Reticle
    reticle.initiate = function( options ) {
        this.active         = options.reticle.active        !== false; //default to true;
        this.visible        = options.reticle.visible       !== false; //default to true;
        this.far            = options.reticle.far           || settings.camera.far-10.0;
        this.color          = options.reticle.color         || 0xcc0000;
        this.colorTo        = options.reticle.colorTo       || 0xcc0000;
        this.innerRadius    = options.reticle.innerRadius   || 0.0001;
        this.outerRadius    = options.reticle.outerRadius   || 0.003;
        this.innerRadiusTo  = options.reticle.innerRadiusTo || 0.02;
        this.outerRadiusTo  = options.reticle.outerRadiusTo || 0.024;
        this.hit            = false;
        //Animation options
        this.animate        = options.reticle.animate       !== false; //default to true;
        this.speed          = options.reticle.speed         || 5;
        this.moveSpeed      = 0;
        
        //If not active
        if(!this.active) return;
        
        //Geometry
        var geometry = new THREE.RingGeometry( this.innerRadius, this.outerRadius, 32, 3, 0, Math.PI * 2 );
        var geometryScale = new THREE.RingGeometry( this.innerRadiusTo, this.outerRadiusTo, 32, 3, 0, Math.PI * 2 );
        
        //Add Morph Targets for scale animation
        geometry.morphTargets.push( { name: "target1", vertices: geometryScale.vertices } );
        
        //Make Mesh
        this.crosshair = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { 
            color: this.color,
            morphTargets: true
        }));
        
        //set depth and scale
        this.setDepthAndScale();
        
        //Add to camera
        settings.camera.add( this.crosshair );
    };
    
    //Sets the depth and scale of the reticle - reduces eyestrain and depth issues 
    reticle.setDepthAndScale = function( transformZ ) {
        var crosshair = this.crosshair;
        var z = Math.abs(transformZ || this.far)*-1; //Default to user far setting
        var cameraZ =  settings.camera.position.z;
        //Force reticle to appear the same size - scale
        //http://answers.unity3d.com/questions/419342/make-gameobject-size-always-be-the-same.html
        var scale = Math.abs( cameraZ - z ) - Math.abs( cameraZ );
        
        //Set Depth
        crosshair.position.x = 0;
        crosshair.position.y = 0;
        crosshair.position.z = z;
        
        //Set Scale
        crosshair.scale.set( scale, scale, scale );
    };
    
    reticle.update = function(delta) {
        //If not active
        if(!this.active) return;
        
        var accel = delta * this.speed;
        
        if( this.hit ) {
            this.moveSpeed += accel;
            this.moveSpeed = Math.min(this.moveSpeed, 1);
        } else {
            this.moveSpeed -= accel;
            this.moveSpeed = Math.max(this.moveSpeed, 0);
        }
        //Morph
        this.crosshair.morphTargetInfluences[ 0 ] = this.moveSpeed;
    };

    var initiate = function (camera, options) {
        //Update Settings:
        if (options) {
            settings.camera = camera; //required
            settings.gazingDuration = options.gazingDuration || settings.gazingDuration;
            settings.proximity = options.proximity || settings.proximity;
        }
        
        //Raycaster Setup
        raycaster = new THREE.Raycaster();
        vector = new THREE.Vector2(0, 0);

        //Proximity Setup
        if( settings.proximity ) {
            frustum = new THREE.Frustum();
            cameraViewProjectionMatrix = new THREE.Matrix4();
        }
        
        //Clock Setup
        clock = new THREE.Clock(true);
        
        //Initiate Reticle
        reticle.initiate(options);
    };
    
    var proximity = function() {
        var camera = settings.camera;
        var showReticle = false;
        
        //Use frustum to see if any targetable object is visible
        //http://stackoverflow.com/questions/17624021/determine-if-a-mesh-is-visible-on-the-viewport-according-to-current-camera
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.getInverse( camera.matrixWorld );
        cameraViewProjectionMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );

        frustum.setFromMatrix( cameraViewProjectionMatrix );
        

        for( var i =0, l=collisionList.length; i<l; i++) {

            var newObj = collisionList[i];

            if(!newObj.gazeable) {
                continue;
            }

            if( frustum.intersectsObject( newObj ) ) {
                showReticle = true;
                break;
            }

        }
        reticle.crosshair.visible = showReticle;
        
    };

    var detectHit = function() {
        try {
            raycaster.setFromCamera( vector, settings.camera );
        } catch (e) {
            //Assumes PerspectiveCamera for now... 
            //Support for Three.js < rev70
            raycaster.ray.origin.copy( settings.camera.position );
            raycaster.ray.direction.set( vector.x, vector.y, 0.5 ).unproject( settings.camera ).sub( settings.camera.position ).normalize();
        }

        //
        var intersects = raycaster.intersectObjects(collisionList);
        //Detect
        if (intersects.length) {

            var newObj = intersects[ 0 ].object

            //Is it a new object?
            if( INTERSECTED != newObj ) {
                //If old INTERSECTED i.e. not null reset and gazeout 
                if ( INTERSECTED ) {
                    gazeOut(INTERSECTED);
                };
                
                //If new object is not gazeable skip it.
                if (!newObj.gazeable) {
                    return;
                }

                //Updated INTERSECTED with new object
                INTERSECTED = newObj;
                //Is the object gazeable?
                //if (INTERSECTED.gazeable) {
                    //Yes
                    gazeOver(INTERSECTED);
                //}
            } else {
                //Ok it looks like we are in love
                gazeLong(INTERSECTED);
            }

        } else {
            //Is the object gazeable?
            //if (INTERSECTED.gazeable) {
                if (INTERSECTED) {
                    //GAZE OUT
                    gazeOut(INTERSECTED);
                }
            //}
            INTERSECTED = null;

        }
    };

    var gazeOut = function(threeObject) {
        threeObject.hitTime = 0;
        if ( reticle.active ) {
            reticle.hit = false;
            reticle.setDepthAndScale();
        }
        if ( threeObject.ongazeout != undefined ) {
            threeObject.ongazeout();
        }
    };

    var gazeOver = function(threeObject) {
        var distance;
        threeObject.hitTime = clock.getElapsedTime();
        //There has to be a better  way...
        if( reticle.active ) {
            distance = settings.camera.position.distanceTo(threeObject.position);
            distance -= threeObject.geometry.boundingSphere.radius;
            reticle.hit = true;
            reticle.setDepthAndScale( distance );
        }
        //Does object have an action assigned to it?
        if (threeObject.ongazeover != undefined) {
            threeObject.ongazeover();
        }
    };

    var gazeLong = function( threeObject ) {
        var elapsed = clock.getElapsedTime();
        if( elapsed - threeObject.hitTime >= settings.gazingDuration ) {
            //Does object have an action assigned to it?
            if (threeObject.ongazelong != undefined) {
                threeObject.ongazelong();
            }
            //Reset the clock
            threeObject.hitTime = elapsed;
        }
    };

    
    return {
        addCollider: function (threeObject) {
            threeObject.gazeable = true;
            collisionList.push(threeObject);
        },
        removeCollider: function (threeObject) {
            var index = collisionList.indexOf(threeObject);
            threeObject.gazeable = false;
            if (index > -1) {
                collisionList.splice(index, 1);
            }
        },
        update: function () {
            var delta = clock.getDelta(); //
            detectHit();
            
            //Proximity
            if(settings.proximity) {
                proximity();
            }
            
            //Animation
            if( reticle.animate ) {
                reticle.update(delta);
            }
            
        },
        init: function (camera, options) {
            var c = camera || null;
            var o = options || {};
            if ( !c instanceof THREE.Camera ) {
                console.error("ERROR: Camera was not correctly defined. Unable to initiate Reticulum.");
                return;
            }
            initiate(c, o);
        }
    };
})();