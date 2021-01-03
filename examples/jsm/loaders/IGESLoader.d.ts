import {
	BufferGeometry,
	Loader,
	LoadingManager,
	Scene
} from '../../../src/Three';

export interface IgesGeometry{
	library: object;
	scene: Scene;
}

export class IGESLoader extends Loader {

	constructor( manager?: LoadingManager );

	load( url: string, onLoad: ( geometry: IgesGeometry ) => void, onProgress?: ( event: ProgressEvent ) => void, onError?: ( event: ErrorEvent ) => void ) : void;
	parse( data: ArrayBuffer | string ) : IgesGeometry;

}
