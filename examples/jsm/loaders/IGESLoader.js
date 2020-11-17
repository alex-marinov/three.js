import {
	BufferAttribute,
	BufferGeometry,
	FileLoader,
	Float32BufferAttribute,
	Group,
	Line,
	LineBasicMaterial,
	Loader,
	LoaderUtils,
	Points,
	PointsMaterial,
	Vector3
} from "../../../build/three.module.js";

/**
 * Description: A THREE loader for IGES files, as created by Solidworks and other CAD programs.
 *
 * IGES Version 6.0 - https://filemonger.com/specs/igs/devdept.com/version6.pdf
 * More info on IGES see wiki page: https://en.wikipedia.org/wiki/IGES
 * 
 * Useage:
 *  var loader = new IGESLoader();
 *	loader.load( '/path/to/file.igs', function ( geometry ) {
 *		scene.add( geometry );
 *	});
 * 
 * 
 * 
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
		loader.setResponseType( 'text' );

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

		// IGES Parser Start

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
			for(var i = 0; i < data.length; i += 160) { //144
				var entity = new Entity();
				var attr = entity.attr;
				var item = data.substr(i, 160); //144
				attr.entityType = parseInt(item.substr(0, 8));
				attr.entityIndex = parseInt(item.substr(8, 8));
				attr.igesVersion = parseInt(item.substr(16, 8));
				attr.lineType = parseInt(item.substr(24, 8));
				attr.level = parseInt(item.substr(32, 8));
				attr.view = parseInt(item.substr(40, 8));
				attr.transMatrix = parseInt(item.substr(48, 8));
				attr.labelDisp = parseInt(item.substr(56, 8));
				attr.status = item.substr(64, 8);
				attr.sequenceNumber = parseInt(item.substr(73, 7));

				attr.lineWidth = parseInt(item.substr(88, 8));
				attr.color = parseInt(item.substr(96, 8));
				attr.paramLine = parseInt(item.substr(104, 8));
				attr.formNumber = parseInt(item.substr(112, 8));
			
				attr.entityName = item.substr(136, 8).trim();
				attr.entitySub = parseInt(item.substr(144, 8));
			
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
			var geometry = new Group(); // []; // new BufferGeometry();
			console.log(data);

			var iges = new IGES();
			var lines = data.split('\n').filter(function(item){ return item != '' });
			var currentSection = '';
			var startSec = '', globalSec = '', dirSec = '', paramSec = '', terminateSec = '';
			var line = '';
			for(var i = 0; i < lines.length; i++){
				line = lines[i];
				currentSection = line[72]; //72
				line = line.substr(0, 80); //0,72
				switch (currentSection){
				case 'S': {
					startSec += line.substr(0, 72).trim();
					break;
				}
				case 'G': {
					globalSec += line.substr(0, 72).trim();
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
					terminateSec += line.substr(0, 72).trim();
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

			console.log("inside parseIges | All Entities:")
			console.log(iges.entities);

			var entities = iges.entities
			//console.log("Entities: ")
			//console.log(new Set(entities.map((e) => parseInt(e.type)).sort()))
			
			var vertices = [];
			var groupCount = 0;
			var startVertex = 0;
			var endVertex = 0;

			var entity
			for(var i = 0; i < entities.length; i++) {
			  entity = entities[i]
			  switch (entity.type) {
				case '100': drawCArc(entity);break;
				case '102': drawCCurve(entity);break;
				case '106':	drawPath(entity);break;
				case '108': drawPlane(entity);break;
				case '110': drawLine(entity);break;
				case '116': drawPoint(entity);break;
				case '120': drawRSurface(entity);break;
				case '122': drawTCylinder(entity);break;
				case '124': drawTransMatrix(entity);break;
				case '126': drawRBSplineCurve(entity);break;
				case '128': drawRBSplineSurface(entity);break;
				case '142': drawCurveOnPSurface(entity);break;
				case '144': drawTPSurface(entity);break;
				case '314': drawColor(entity);break;
				case '402': drawAInstance(entity);break;
				case '406': propertyEntity(entity);break;
				default: console.log('Uncompliment entity type', entity.type)
			  }
			}

			function getBySequence(arr, sequence) {
				for (var i=0, iLen=arr.length; i<iLen; i++) {
					if (arr[i].attr.sequenceNumber == sequence) return arr[i];
				}
			}

			/*
			*	CIRCULAR ARC ENTITY (TYPE 100)
			*
			* 	Parameter Data
			*
			*	Index 	Name 	Type 	Description
			*	1 		ZT 		Real 	Parallel ZT displacement of arc from XT ; YT plane
			*	2 		X1 		Real 	Arc center abscissa
			*	3 		Y1 		Real 	Arc center ordinate
			*	4 		X2 		Real 	Start point abscissa
			*	5 		Y2 		Real 	Start point ordinate
			*	6 		X3 		Real 	Terminate point abscissa
			*	7 		Y3 		Real 	Terminate point ordinate
			*/
			function drawCArc(entity){
				console.log("inside drawCArc")
				console.log(entity)

				var entityAttr = entity.attr
				console.log("transMatrix: " + entityAttr["transMatrix"])

				var entityParams = entity.params

				console.log(getBySequence(entities, entityAttr["transMatrix"]));
			}

			/*
			*	COMPOSITE CURVE ENTITY (TYPE 102)
			*
			*	Parameter Data
			*
			*	Index 	Name 	Type 	Description
			*	1 		N 		Integer Number of entities
			*	2 		DE(1) 	Pointer Pointer to the DE of the first constituent entity
			*	.		.		.
			*	.		.		.
			*	.		.		.
			*	1+N 	DE(N) 	Pointer Pointer to the DE of the last constituent entity
			*/
			function drawCCurve(entity){
				console.log("inside drawCCurve")
				console.log(entity)

				var entityAttr = entity.attr
				//console.log("" + entityAttr[""])

				var entityParams = entity.params
			}

			/*
			*	COPIOUS DATA ENTITY (TYPE 106, FORMS 1-3)
			*	LINEAR PATH ENTITY (TYPE 106, FORMS 11-13)
			*	CENTERLINE ENTITY (TYPE 106, FORMS 20-21)
			*	SECTION ENTITY (TYPE 106, FORMS 31–38)
			*	WITNESS LINE ENTITY (TYPE 106, FORM 40)
			* 	SIMPLE CLOSED PLANAR CURVE ENTITY (TYPE 106, FORM 63)
			*	
			*/
			function drawPath(entity){
				console.log("inside drawPath")
				console.log(entity)

				var entityAttr = entity.attr
				var entityParams = entity.params

				var geom = new BufferGeometry();
				var points = [];

				switch (entityAttr["formNumber"].toString()) {
					/*
					*	LINEAR PATH ENTITY (TYPE 106, FORMS 11-13)
					*
					*	Parameter Data
					*	
					*	For IP=2 (x,y,z triples), i.e., for Form 12:
					*	Index 	Name 	Type 	Description
					*	1		IP		Integer	Interpretation Flag
					*							1 = x,y pairs, common z
					*							2 = x,y,z coordinates
					*							3 = x,y,z coordinates and i,j,k vectors
					*	2		N		Integer	Number of n-tuples; N >= 2		
					*	
					*	For IP=2 (x,y,z triples), i.e., for Form 12:			
					*	3 		X(1) 	Real 	First data point x value
					*	4 		Y(1) 	Real 	First data point y value
					*	5 		Z(1) 	Real 	First data point z value
					*	.		.		.
					*	.		.		.
					*	.		.		.
					*	2+3*N 	Z(N) 	Real 	Last data point z value
					*/
					case '12':
						for(var i = 0; i < entityParams[1]; i++){
							points.push( new Vector3((parseFloat(entityParams[2+3*i])), parseFloat(entityParams[3+3*i]), parseFloat(entityParams[4+3*i]) ));
						}
						break;
					/*
					*	WITNESS LINE ENTITY (TYPE 106, FORM 40)
					*
					*	Parameter Data
					*
					*	Index 	Name 	Type 	Description
					*	1 		IP 		Integer Interpretation Flag: IP = 1
					*	2 		N 		Integer Number of data points: N ¸ 3 and odd
					*	3 		ZT 		Real 	Common z displacement
					*	4 		X(1) 	Real 	First data point abscissa
					*	5 		Y(1) 	Real 	First data point ordinate
					*	.		.		.
					*	.		.		.
					*	.		.		.
					*	3+2*N 	Y(N) 	Real 	Last data point ordinate
					*/
					case '40':
						for(var i = 0; i < entityParams[1]; i++){
							points.push( new Vector3((parseFloat(entityParams[3+2*i])), parseFloat(entityParams[4+2*i]), 0 ));
						}
						break;

					case '63':
						for(var i = 0; i < entityParams[1]; i++){
							points.push( new Vector3((parseFloat(entityParams[3+2*i])), parseFloat(entityParams[4+2*i]), 0 ));
						}
						break;
						
					default: console.log('Unsupported Form Number: ', entity.attr["formNumber"])
				}

				geom.setFromPoints(points);

				var material = new LineBasicMaterial( { color: 0x0000ff } );
				var mesh = new Line( geom, material );

				mesh.position.set( -15, 0, 0 );
				mesh.rotation.set( - Math.PI / 2, 0, 0 ); //
				var scaleFactor = 0.01;
				mesh.scale.set( scaleFactor, scaleFactor, scaleFactor );

				mesh.castShadow = true;
				mesh.receiveShadow = true;

				geometry.add(mesh);
			}

			//LINE ENTITY (TYPE 110, FORM 0)
			//LINE ENTITY (TYPE 110, FORMS 1-2)
			function drawLine(entity){
				//console.log("inside drawLine")
				//console.log(entity)

				var entityAttr = entity.attr
				var entityParams = entity.params

				var geom = new BufferGeometry();
				var points = [];

				switch (entityAttr["formNumber"].toString()) {
					/*
					*	LINE ENTITY (TYPE 110, FORMS 0)
					*
					*	Index 	Name 	Type 	Description
					*	1 		X1 		Real 	Start Point P1
					*	2 		Y1 		Real
					*	3 		Z1 		Real
					*	4 		X2 		Real 	Terminate Point P2
					*	5 		Y2 		Real
					*	6 		Z2 		Real
					*/
					case '0':
						points.push( new Vector3((parseFloat(entityParams[0])), parseFloat(entityParams[1]), parseFloat(entityParams[2]) ));
						points.push( new Vector3((parseFloat(entityParams[3])), parseFloat(entityParams[4]), parseFloat(entityParams[5]) ));
						break;	
					// TODO - Form 1-2					
					default: console.log('LINE ENTITY - TYPE 110 - Unsupported Form Number: ', entity.attr["formNumber"])
				}

				geom.setFromPoints(points);

				var material = new LineBasicMaterial( { color: 0x0000ff } );
				var mesh = new Line( geom, material );

				mesh.position.set( -15, 4, 0 );
				mesh.rotation.set( - Math.PI / 2, 0, 0 ); //
				var scaleFactor = 0.01;
				mesh.scale.set( scaleFactor, scaleFactor, scaleFactor );

				mesh.castShadow = true;
				mesh.receiveShadow = true;

				geometry.add(mesh);

			}

			//116
			function drawPoint(entity){
				console.log("inside drawPoint")
				console.log(entity)

				var entityParams = entity.params
				var entityAttr = entity.attr

				var geom = new BufferGeometry();

				const points = [];
				points.push( entityParams[0], entityParams[1], entityParams[2] );
				
				geom.setFromPoints(points);
				geom.setAttribute( 'position', new Float32BufferAttribute( points, 3 ) );

				const material = new PointsMaterial( { size: 5, sizeAttenuation: false } );
				const mesh = new Points( geom, material );

				mesh.position.set( 0, -0.2, 0 );
				mesh.rotation.set( - Math.PI / 2, 0, 0 );
				mesh.scale.set( 0.5, 0.5, 0.5 );

				mesh.castShadow = true;
				mesh.receiveShadow = true;		
				
				geometry.add(mesh);
			}

			//124 TRANSFORMATION MATRIX ENTITY
			/*
			*	TRANSFORMATION MATRIX ENTITY (TYPE 124)
			*
			*	Parameter Data
			*
			*	Index 	Name 	Type 	Description
			*	1 		R11 	Real 	Top Row
			*	2 		R12 	Real 	.
			*	3 		R13 	Real 	.
			*	4 		T1 		Real 	.
			*	5 		R21 	Real 	Second Row
			*	6 		R22 	Real 	.
			*	7 		R23 	Real 	.
			*	8 		T2 		Real 	.
			*	9 		R31 	Real 	Third Row
			*	10 		R32 	Real 	.
			*	11 		R33 	Real 	.
			*	12 		T3 		Real 	.
			*
			*/
			function drawTransMatrix(entity){
				//console.log("inside drawTransMatrix")
				//console.log(entity)

				var entityParams = entity.params
				var entityAttr = entity.attr

				switch (entityAttr["formNumber"].toString()) {
					/*
					*	Form 0: (default) 	R is an orthonormal matrix with determinant equal to positive one. T is arbitrary.
					*						The columns of R; taken in order, form a right-handed triple in the output coordinate system.
					*/
					case '0':
						break;	
					// TODO - Form 1, 10, 11, 12
					default: console.log('LINE ENTITY - TYPE 110 - Unsupported Form Number: ', entity.attr["formNumber"])
				}

				console.log("TransMatrix sequenceNumber: ", entityAttr["sequenceNumber"], "formNumber: ", entityAttr["formNumber"])
				console.log("R11 ", entityParams[0], " R12 ", entityParams[1], " R13 ", entityParams[2], " T1 ", entityParams[3])
				console.log("R21 ", entityParams[4], " R22 ", entityParams[5], " R23 ", entityParams[6], " T2 ", entityParams[7])
				console.log("R31 ", entityParams[8], " R32 ", entityParams[9], " R33 ", entityParams[10], " T3 ", entityParams[11])
			}

			//126 RATIONAL B-SPLINE CURVE ENTITY
			function drawRBSplineCurve(entity) {
		  
			}

			//128 RATIONAL B-SPLINE SURFACE ENTITY
			function drawRBSplineSurface(entity) {
		  
			}

			//142 CURVE ON A PARAMETRIC SURFACE ENTITY
			function drawCurveOnPSurface(entity) {
				console.log("inside drawCurveOnPSurface")
				console.log(entity)
			}

			/*
			*	TRIMMED (PARAMETRIC) SURFACE ENTITY (TYPE 144)	
			*	Parameter Data
			*	Index	Name	Type	Description
			*	1		PTS 	Pointer Pointer to the DE of the surface entity that is to be trimmed
			*	2		N1 		Integer	0 = the outer boundary is the boundary of D
			*							1 = otherwise
			*	3		N2		Integer This number indicates the number of simple closed curves which
			*							constitute the inner boundary of the trimmed surface. In case
			*							no inner boundary is introduced, this is set equal to zero.
			*	4 		PTO 	Pointer Pointer to the DE of the Curve on a Parametric Surface Entity
			*							that constitutes the outer boundary of the trimmed surface or
			*							zero
			*	5 		PTI(1) 	Pointer Pointer to the DE of the first simple closed inner boundary
			*							curve entity (Curve on a Parametric Surface Entity) according
			*							to some arbitrary ordering of these entities
			*	.		.		.
			*	.		.		.
			*	.		.		.
			*	4+N2 	PTI(N2) Pointer Pointer to the DE of the last simple closed inner boundary curve
			*							entity (Curve on a Parametric Surface Entity)
			*/
			function drawTPSurface(entity) {
				console.log("inside drawTPSurface")
				console.log(entity)
				// TODO
			}

			/*
			*	COLOR DEFINITION ENTITY (TYPE 314)
			*
			*	Parameter Data
			*
			*	Index 	Name 	Type 	Description
			*	1 		CC1 	Real 	First color coordinate (red) as a percent of full intensity (range 0.0 to 100.0)
			*	2 		CC2 	Real 	Second color coordinate (green) as a percent of full intensity (range 0.0 to 100.0)
			*	3 		CC3 	Real 	Third color coordinate (blue) as a percent of full intensity (range 0.0 to 100.0)
			*	4 		CNAME 	String 	Color name; this is an optional character string which may contain
			*							some verbal description of the color. If the color name
			*							is not provided and additional pointers are required, the color
			*							name shall be defaulted.
			*/
			function drawColor(entity){
				console.log("inside drawColor")
				console.log(entity)
				// TODO
			}

			/*
			*	PROPERTY ENTITY (TYPE 406)

				Parameter Data

				Index 	Name 	Type 		Description
				1 		NP 		Integer 	Number of property values
				2 		V(1) 	Variable 	First property value
				.		.		.
				.		.		.
				.		.		.
				1+NP 	V(NP) 	Variable 	Last property value

			*/
			function propertyEntity(entity){
				console.log("inside propertyEntity")
				console.log(entity)
				// TODO

			}

			return geometry;
		}
		
		function parseIgesFloat(p){
			return parseFloat(p.replace(/D/g, "e"));
		}

		function parseIgesString(str){
			// iges string (fortran) form: <length>H<str>
			try {
				var d = str.indexOf('H');
				if(d == -1) return null;
				var digit = str.substr(0, d);
				var value = str.substr(d+1, digit);
				return value;
			} catch (e) {
				console.error(e);
			}
		}

		return parseIges(data);

	}

} );

export { IGESLoader };