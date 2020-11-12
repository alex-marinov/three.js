import {
	BufferAttribute,
	BufferGeometry,
	FileLoader,
	Float32BufferAttribute,
	Loader,
	LoaderUtils,
	Vector3
} from "../../../build/three.module.js";

/**
 * Description: A THREE loader for IGES files, as created by Solidworks and other CAD programs.
 *
 * TODO: UPDATE DESCRIPTION
 */


var IGESLoader = function ( manager ) {

	Loader.call( this, manager );

};

IGESLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	constructor: IGESLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType();
		//loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );

		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text ) );

			} catch ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );

			}

		}, onProgress, onError );

	},

	parse: function ( data ) {

		function isBinary( data ) {

			var expect, face_size, n_faces, reader;
			reader = new DataView( data );
			face_size = ( 32 / 8 * 3 ) + ( ( 32 / 8 * 3 ) * 3 ) + ( 16 / 8 );
			n_faces = reader.getUint32( 80, true );
			expect = 80 + ( 32 / 8 ) + ( n_faces * face_size );

			if ( expect === reader.byteLength ) {

				return true;

			}

			// An ASCII STL data must begin with 'solid ' as the first six bytes.
			// However, ASCII STLs lacking the SPACE after the 'd' are known to be
			// plentiful.  So, check the first 5 bytes for 'solid'.

			// Several encodings, such as UTF-8, precede the text with up to 5 bytes:
			// https://en.wikipedia.org/wiki/Byte_order_mark#Byte_order_marks_by_encoding
			// Search for "solid" to start anywhere after those prefixes.

			// US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'

			var solid = [ 115, 111, 108, 105, 100 ];

			for ( var off = 0; off < 5; off ++ ) {

				// If "solid" text is matched to the current offset, declare it to be an ASCII STL.

				if ( matchDataViewAt( solid, reader, off ) ) return false;

			}

			// Couldn't find "solid" text at the beginning; it is binary STL.

			return true;

		}

		function matchDataViewAt( query, reader, offset ) {

			// Check if each byte in query matches the corresponding byte from the current offset

			for ( var i = 0, il = query.length; i < il; i ++ ) {

				if ( query[ i ] !== reader.getUint8( offset + i, false ) ) return false;

			}

			return true;

		}

		function parseBinary( data ) {

			var reader = new DataView( data );
			var faces = reader.getUint32( 80, true );

			var r, g, b, hasColors = false, colors;
			var defaultR, defaultG, defaultB, alpha;

			// process STL header
			// check for default color in header ("COLOR=rgba" sequence).

			for ( var index = 0; index < 80 - 10; index ++ ) {

				if ( ( reader.getUint32( index, false ) == 0x434F4C4F /*COLO*/ ) &&
					( reader.getUint8( index + 4 ) == 0x52 /*'R'*/ ) &&
					( reader.getUint8( index + 5 ) == 0x3D /*'='*/ ) ) {

					hasColors = true;
					colors = new Float32Array( faces * 3 * 3 );

					defaultR = reader.getUint8( index + 6 ) / 255;
					defaultG = reader.getUint8( index + 7 ) / 255;
					defaultB = reader.getUint8( index + 8 ) / 255;
					alpha = reader.getUint8( index + 9 ) / 255;

				}

			}

			var dataOffset = 84;
			var faceLength = 12 * 4 + 2;

			var geometry = new BufferGeometry();

			var vertices = new Float32Array( faces * 3 * 3 );
			var normals = new Float32Array( faces * 3 * 3 );

			for ( var face = 0; face < faces; face ++ ) {

				var start = dataOffset + face * faceLength;
				var normalX = reader.getFloat32( start, true );
				var normalY = reader.getFloat32( start + 4, true );
				var normalZ = reader.getFloat32( start + 8, true );

				if ( hasColors ) {

					var packedColor = reader.getUint16( start + 48, true );

					if ( ( packedColor & 0x8000 ) === 0 ) {

						// facet has its own unique color

						r = ( packedColor & 0x1F ) / 31;
						g = ( ( packedColor >> 5 ) & 0x1F ) / 31;
						b = ( ( packedColor >> 10 ) & 0x1F ) / 31;

					} else {

						r = defaultR;
						g = defaultG;
						b = defaultB;

					}

				}

				for ( var i = 1; i <= 3; i ++ ) {

					var vertexstart = start + i * 12;
					var componentIdx = ( face * 3 * 3 ) + ( ( i - 1 ) * 3 );

					vertices[ componentIdx ] = reader.getFloat32( vertexstart, true );
					vertices[ componentIdx + 1 ] = reader.getFloat32( vertexstart + 4, true );
					vertices[ componentIdx + 2 ] = reader.getFloat32( vertexstart + 8, true );

					normals[ componentIdx ] = normalX;
					normals[ componentIdx + 1 ] = normalY;
					normals[ componentIdx + 2 ] = normalZ;

					if ( hasColors ) {

						colors[ componentIdx ] = r;
						colors[ componentIdx + 1 ] = g;
						colors[ componentIdx + 2 ] = b;

					}

				}

			}

			geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );
			geometry.setAttribute( 'normal', new BufferAttribute( normals, 3 ) );

			if ( hasColors ) {

				geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) );
				geometry.hasColors = true;
				geometry.alpha = alpha;

			}

			return geometry;

		}

		function parseASCII( data ) {

			var geometry = new BufferGeometry();
			var patternSolid = /solid([\s\S]*?)endsolid/g;
			var patternFace = /facet([\s\S]*?)endfacet/g;
			var faceCounter = 0;

			var patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
			var patternVertex = new RegExp( 'vertex' + patternFloat + patternFloat + patternFloat, 'g' );
			var patternNormal = new RegExp( 'normal' + patternFloat + patternFloat + patternFloat, 'g' );

			var vertices = [];
			var normals = [];

			var normal = new Vector3();

			var result;

			var groupCount = 0;
			var startVertex = 0;
			var endVertex = 0;

			while ( ( result = patternSolid.exec( data ) ) !== null ) {

				startVertex = endVertex;

				var solid = result[ 0 ];

				while ( ( result = patternFace.exec( solid ) ) !== null ) {

					var vertexCountPerFace = 0;
					var normalCountPerFace = 0;

					var text = result[ 0 ];

					while ( ( result = patternNormal.exec( text ) ) !== null ) {

						normal.x = parseFloat( result[ 1 ] );
						normal.y = parseFloat( result[ 2 ] );
						normal.z = parseFloat( result[ 3 ] );
						normalCountPerFace ++;

					}

					while ( ( result = patternVertex.exec( text ) ) !== null ) {

						vertices.push( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );
						normals.push( normal.x, normal.y, normal.z );
						vertexCountPerFace ++;
						endVertex ++;

					}

					// every face have to own ONE valid normal

					if ( normalCountPerFace !== 1 ) {

						console.error( 'THREE.IGESLoader: Something isn\'t right with the normal of face number ' + faceCounter );

					}

					// each face have to own THREE valid vertices

					if ( vertexCountPerFace !== 3 ) {

						console.error( 'THREE.IGESLoader: Something isn\'t right with the vertices of face number ' + faceCounter );

					}

					faceCounter ++;

				}

				var start = startVertex;
				var count = endVertex - startVertex;

				geometry.addGroup( start, count, groupCount );
				groupCount ++;

			}

			geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
			geometry.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );

			return geometry;

		}

		function ensureString( buffer ) {

			if ( typeof buffer !== 'string' ) {

				return LoaderUtils.decodeText( new Uint8Array( buffer ) );

			}

			return buffer;

		}

		function ensureBinary( buffer ) {

			if ( typeof buffer === 'string' ) {

				var array_buffer = new Uint8Array( buffer.length );
				for ( var i = 0; i < buffer.length; i ++ ) {

					array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

				}

				return array_buffer.buffer || array_buffer;

			} else {

				return buffer;

			}

		}

		// IGES Perser Start

		var Entity = function(attribute = {entityType:''}, params = []){
			this.type = attribute.entityType
			this.attr = attribute
			this.params = params
		}
		  
		function IGES(){
			this.fieldDelimiter = ','; // as default
			this.termDelimiter = ';';  // as default 
			this.entities = new Array();
			return this;
		}
		
		IGES.prototype.parseStart = function (data) {
			this.comment = data
		}

		IGES.prototype.parseGlobal = function (data) {
			if(data[0] != ',') {
				this.fieldDelimiter = parseIgesString(data);
			}
			var fields = data.split(this.fieldDelimiter);
			if(data[0] != ',') { fields.splice(0, 1); }
			
			this.termDelimiter = parseIgesString(fields[1]) || ';';
			this.exportID = parseIgesString(fields[2]);
			this.fileName = parseIgesString(fields[3]);
			this.systemID = parseIgesString(fields[4]);
			this.translateVer = parseIgesString(fields[5]);
			this.integerBits = fields[6];
			this.singleExpBits = fields[7];
			this.singleMantissaBits = fields[8];
			this.doubleExpBits = fields[9];
			this.doubleMantissaBits = fields[10];
			this.receiveID = parseIgesString(fields[11]);
			this.scale = fields[12];
			this.unitFlag = fields[13];
			this.unit = parseIgesString(fields[14]);
			this.maxStep = fields[15];
			this.maxWidth = fields[16];
			this.createDate = parseIgesString(fields[17]);
			this.resolution = fields[18];
			this.maxValue = fields[19];
			this.createUser = parseIgesString(fields[20]);
			this.createOrg = parseIgesString(fields[21]);
			this.igesVer = fields[22];
			this.formatCode = fields[23];
			this.lastModifiedDate = parseIgesString(fields[24]);
		}

		IGES.prototype.parseDirection = function (data) {
			for(var i = 0; i < data.length; i += 144) {
				var entity = new Entity();
				var attr = entity.attr;
				var item = data.substr(i, 144);
				attr.entityType = parseInt(item.substr(0, 8));
				attr.entityIndex = parseInt(item.substr(8, 8));
				attr.igesVersion = parseInt(item.substr(16, 8));
				attr.lineType = parseInt(item.substr(24, 8));
				attr.level = parseInt(item.substr(32, 8));
				attr.view = parseInt(item.substr(40, 8));
				attr.transMatrix = parseInt(item.substr(48, 8));
				attr.labelDisp = parseInt(item.substr(56, 8));
				attr.status = item.substr(64, 8);
			
				attr.lineWidth = parseInt(item.substr(80, 8));
				attr.color = parseInt(item.substr(88, 8));
				attr.paramLine = parseInt(item.substr(96, 8));
				attr.formNumber = parseInt(item.substr(104, 8));
			
				attr.entityName = item.substr(128, 8).trim();
				attr.entitySub = parseInt(item.substr(136, 8));
			
				this.entities.push(entity);
			}
		}

		IGES.prototype.parseParameter = function (data) {
			var params = data.split(';');
			params.pop();
			params = params.map(function(item) {
				return item.split(',');
			})
			var entity;
			for(var i = 0; i < params.length; i++) {
				entity = this.entities[i];
				entity.type = params[i].shift();
				entity.params = params[i].map(parseIgesFloat)
			}
		}
		
		IGES.prototype.parseTerminate = function (data) {
			this.lineNum_S = parseInt(data.substr(1, 7));
			this.lineNum_G = parseInt(data.substr(9, 7));
			this.lineNum_D = parseInt(data.substr(17, 7));
			this.lineNum_P = parseInt(data.substr(25, 7));
			
			if(this.entities.length != (this.lineNum_D / 2)) throw new Error('ERROR: Inconsistent')
		}
		
		function parseIges(data){
			var geometry = new BufferGeometry();
			//console.log(data);

			var iges = new IGES();
			var lines = data.split('\n').filter(function(item){ return item != '' });
			var currentSection = '';
			var startSec = '', globalSec = '', dirSec = '', paramSec = '', terminateSec = '';
			var line = '';
			for(var i = 0; i < lines.length; i++){
				line = lines[i];
				currentSection = line[72];
				line = line.substr(0, 72);
				switch (currentSection){
				case 'S': {
					startSec += line.trim();
					break;
				}
				case 'G': {
					globalSec += line.trim();
					break;
				}
				case 'D': {
					dirSec += line;
					break;
				}
				case 'P': {
					paramSec += line.substr(0, 64).trim();
					break;
				}
				case 'T': {
					terminateSec += line;
					break;
				}
				default: throw new TypeError('ERROR: Unknown IGES section type');
				}
			}
			iges.parseStart(startSec);
			iges.parseGlobal(globalSec);
			iges.parseDirection(dirSec);
			iges.parseParameter(paramSec);
			iges.parseTerminate(terminateSec);

			console.log(iges.entities);

			var entities = iges.entities
			//console.log(new Set(entities.map((e) => parseInt(e.type)).sort()))
			var entity
			for(var i = 0; i < entities.length; i++) {
			  entity = entities[i]
			  switch (entity.type) {
				case '100': drawCArc(entity);break;
				case '102': drawCCurve(entity);break;
				case '106': drawPath(entity);break;
				case '108': drawPlane(entity);break;
				case '110': drawLine(entity);break;
				case '116': drawPoint(entity);break;
				case '120': drawRSurface(entity);break;
				case '122': drawTCylinder(entity);break;
				case '124': drawTransMatrix(entity);break;
				case '126': drawRBSplineCurve(entity);break;
				case '142': drawCurveOnPSurface(entity);break;
				case '144': drawTPSurface(entity);break;
				case '314': drawColor(entity);break;
				case '402': drawAInstance(entity);break;
				default: console.log('Uncompliment entity type', entity.type)
			  }
			}

			function drawPoint(entity){
				var entityParams = entity.params
				console.log("entityParams")
				console.log(entityParams)
				var entityAttr = entity.attr
				console.log("entityAttr")
				console.log(entityAttr)
			  
				console.log("Point Name: " + entityAttr["entityName"])
				console.log("X: " + entityParams[0])
				console.log("Y: " + entityParams[1])
				console.log("Z: " + entityParams[2])

				const points = [];
				points.push( new Vector3( entityParams[0], entityParams[1], entityParams[2] ) );
				//points.push( new Vector3( entityParams[15], entityParams[16], entityParams[17] ) );
				//points.push( new Vector3( 0, 0, 0) );
				//points.push( new Vector3( 0, 1, 0) );
				//points.push( new Vector3( -1, 0, 0) );
				
				//geometry.vertices.push( new THREE.Vector3( entityParams[12], entityParams[13], entityParams[14] ) );
				//geometry.vertices.push( new THREE.Vector3( entityParams[15], entityParams[16], entityParams[17] ) );
				
				geometry.setFromPoints(points);
			}

			function drawRBSplineCurve(entity) {
				//get attribute details
				var entityAttr = entity.attr
				console.log("entityAttr")
				console.log(entityAttr)
			  
				//get parameters
				var entityParams = entity.params
				console.log("entityParams")
				console.log(entityParams)
				
				console.log("Line/Spline Name: " + entityAttr["entityName"])
				console.log("X1: " + entityParams[12])
				console.log("Y1: " + entityParams[13])
				console.log("Z1: " + entityParams[14])
				console.log("X2: " + entityParams[15])
				console.log("Y2: " + entityParams[16])
				console.log("Z2: " + entityParams[17])
			  
				//const line_material = new THREE.LineBasicMaterial({
				//  color: 0x00ff00
				//});
				
				const points = [];
				points.push( new Vector3( entityParams[12], entityParams[13], entityParams[14] ) );
				points.push( new Vector3( entityParams[15], entityParams[16], entityParams[17] ) );
				//points.push( new Vector3( 1, 0, 0) );
				//points.push( new Vector3( 0, 1, 0) );
				//points.push( new Vector3( -1, 0, 0) );
				
				//geometry.vertices.push( new THREE.Vector3( entityParams[12], entityParams[13], entityParams[14] ) );
				//geometry.vertices.push( new THREE.Vector3( entityParams[15], entityParams[16], entityParams[17] ) );
				
				geometry.setFromPoints(points);
				//geometry.vertices.push( new THREE.Vector3( - 10, 0, 0 ) );
				//geometry.vertices.push( new THREE.Vector3( 0, 10, 0 ) );
				//geometry.vertices.push( new THREE.Vector3( 10, 0, 0 ) );
				
				//const line_geometry = new THREE.BufferGeometry().setFromPoints( points );
				//return line_geometry
				//const line = new THREE.Line( line_geometry, line_material );
				//scene.add( line );
			  
				//const box_geometry = new THREE.BoxGeometry();
				//const mesh_material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
				//const cube = new THREE.Mesh( box_geometry, mesh_material );
				//scene.add( cube );

				//geometry.addGroup()
				//return box_geometry;
			  
			  }

			//return iges;
			return geometry;
		}
		
		function parseIgesFloat(p){
			return parseFloat(p.replace(/D/g, "e"));
		}

		function parseIgesString(str){
			// iges string (fortran) form: <length>H<str>
			var d = str.indexOf('H');
			if(d == -1) return null;
			var digit = str.substr(0, d);
			var value = str.substr(d+1, digit);
			return value;
		}

		

		// IGES Parser End

		// start

		var binData = ensureBinary( data );

		return parseIges(data);

		//return isBinary( binData ) ? parseBinary( binData ) : parseASCII( ensureString( data ) );

	}

} );

export { IGESLoader };