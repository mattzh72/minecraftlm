import { mat4, vec3 } from 'gl-matrix'
import * as THREE from 'three'
import type { StructureProvider } from '../core/index.js'
import { BlockState } from '../core/index.js'
import type { Color } from '../index.js'
import { ChunkBuilder } from './ChunkBuilder.js'
import { Mesh } from './Mesh.js'
import type { Resources } from './StructureRenderer.js'

type SunDiscOptions = {
	size?: number,
	distance?: number,
	coreColor?: Color,
	glowColor?: Color,
	coreIntensity?: number,
	glowIntensity?: number,
	softness?: number,
}

type FogOptions = {
	color?: Color,
	density?: number,
	heightFalloff?: number,
}

type SkyOptions = {
	zenithColor?: Color,
	horizonColor?: Color,
	groundColor?: Color,
	sunGlowColor?: Color,
	sunGlowIntensity?: number,
	sunGlowExponent?: number,
}

type ShadowOptions = {
	enabled?: boolean,
	mapSize?: number,
	bias?: number,
	normalBias?: number,
	intensity?: number,
	softness?: number,
	frustumSize?: number,
}

type PostProcessOptions = {
	enabled?: boolean,
	ao?: {
		enabled?: boolean,
		intensity?: number,
		radius?: number,
		samples?: number,
	},
	bloom?: {
		enabled?: boolean,
		threshold?: number,
		intensity?: number,
		radius?: number,
	},
	godRays?: {
		enabled?: boolean,
		intensity?: number,
		decay?: number,
		density?: number,
		samples?: number,
	},
}

type SunlightOptions = {
	direction?: vec3,
	color?: Color,
	ambientColor?: Color,
	fillColor?: Color,
	rimColor?: Color,
	intensity?: number,
	ambientIntensity?: number,
	fillIntensity?: number,
	rimIntensity?: number,
	horizonFalloff?: number,
	exposure?: number,
	sky?: SkyOptions,
	disc?: SunDiscOptions,
	fog?: FogOptions,
	shadow?: ShadowOptions,
	postProcess?: PostProcessOptions,
}

type SunDiscSettings = Required<SunDiscOptions>
type FogSettings = Required<FogOptions>
type SkySettings = Required<SkyOptions>
type ShadowSettings = Required<ShadowOptions>
type PostProcessSettings = {
	enabled: boolean,
	ao: Required<NonNullable<PostProcessOptions['ao']>>,
	bloom: Required<NonNullable<PostProcessOptions['bloom']>>,
	godRays: Required<NonNullable<PostProcessOptions['godRays']>>,
}
type SunlightSettings = Required<Omit<SunlightOptions, 'sky' | 'disc' | 'fog' | 'shadow' | 'postProcess'>> & { sky: SkySettings, disc: SunDiscSettings, fog: FogSettings, shadow: ShadowSettings, postProcess: PostProcessSettings }

type ThreeStructureRendererOptions = {
	chunkSize?: number,
	useInvisibleBlockBuffer?: boolean,
	drawDistance?: number,
	sunlight?: SunlightOptions,
}

const DEFAULT_SUNLIGHT: Omit<SunlightSettings, 'direction'> & { direction: [number, number, number] } = {
	direction: [-0.5, 0.25, 0.5],
	color: [1.0, 0.75, 0.45],
	ambientColor: [0.25, 0.4, 0.6],
	fillColor: [0.35, 0.28, 0.5],
	rimColor: [1.0, 0.55, 0.25],
	intensity: 1.35,
	ambientIntensity: 0.55,
	fillIntensity: 0.3,
	rimIntensity: 0.55,
	horizonFalloff: 0.7,
	exposure: 1.15,
	sky: {
		zenithColor: [0.12, 0.28, 0.56],
		horizonColor: [1.0, 0.55, 0.25],
		groundColor: [0.25, 0.2, 0.25],
		sunGlowColor: [1.0, 0.45, 0.15],
		sunGlowIntensity: 0.6,
		sunGlowExponent: 6.0,
	},
	disc: {
		size: 35,
		distance: 180,
		coreColor: [1.0, 0.98, 0.9],
		glowColor: [1.0, 0.55, 0.15],
		coreIntensity: 2.8,
		glowIntensity: 3.5,
		softness: 0.25,
	},
	fog: {
		color: [0.85, 0.6, 0.4],
		density: 0.001,
		heightFalloff: 0.005,
	},
	shadow: {
		enabled: true,
		mapSize: 2048,
		bias: 0.0005,
		normalBias: 0.02,
		intensity: 0.5,
		softness: 3.0,
		frustumSize: 100,
	},
	postProcess: {
		enabled: true,
		ao: {
			enabled: true,
			intensity: 0.5,
			radius: 0.5,
			samples: 16,
		},
		bloom: {
			enabled: true,
			threshold: 0.8,
			intensity: 0.4,
			radius: 0.6,
		},
		godRays: {
			enabled: false,
			intensity: 0.4,
			decay: 0.95,
			density: 0.8,
			samples: 60,
		},
	},
}

function buildSunlightSettings(options?: SunlightOptions): SunlightSettings {
	const direction = vec3.clone(options?.direction ?? vec3.fromValues(...DEFAULT_SUNLIGHT.direction))
	if (vec3.length(direction) < 1e-5) {
		vec3.set(direction, 0, 1, 0)
	}
	vec3.normalize(direction, direction)

	return {
		direction,
		color: options?.color ?? DEFAULT_SUNLIGHT.color,
		ambientColor: options?.ambientColor ?? DEFAULT_SUNLIGHT.ambientColor,
		fillColor: options?.fillColor ?? DEFAULT_SUNLIGHT.fillColor,
		rimColor: options?.rimColor ?? DEFAULT_SUNLIGHT.rimColor,
		intensity: options?.intensity ?? DEFAULT_SUNLIGHT.intensity,
		ambientIntensity: options?.ambientIntensity ?? DEFAULT_SUNLIGHT.ambientIntensity,
		fillIntensity: options?.fillIntensity ?? DEFAULT_SUNLIGHT.fillIntensity,
		rimIntensity: options?.rimIntensity ?? DEFAULT_SUNLIGHT.rimIntensity,
		horizonFalloff: options?.horizonFalloff ?? DEFAULT_SUNLIGHT.horizonFalloff,
		exposure: options?.exposure ?? DEFAULT_SUNLIGHT.exposure,
		sky: {
			zenithColor: options?.sky?.zenithColor ?? DEFAULT_SUNLIGHT.sky.zenithColor,
			horizonColor: options?.sky?.horizonColor ?? DEFAULT_SUNLIGHT.sky.horizonColor,
			groundColor: options?.sky?.groundColor ?? DEFAULT_SUNLIGHT.sky.groundColor,
			sunGlowColor: options?.sky?.sunGlowColor ?? DEFAULT_SUNLIGHT.sky.sunGlowColor,
			sunGlowIntensity: options?.sky?.sunGlowIntensity ?? DEFAULT_SUNLIGHT.sky.sunGlowIntensity,
			sunGlowExponent: options?.sky?.sunGlowExponent ?? DEFAULT_SUNLIGHT.sky.sunGlowExponent,
		},
		disc: {
			size: options?.disc?.size ?? DEFAULT_SUNLIGHT.disc.size,
			distance: options?.disc?.distance ?? DEFAULT_SUNLIGHT.disc.distance,
			coreColor: options?.disc?.coreColor ?? DEFAULT_SUNLIGHT.disc.coreColor,
			glowColor: options?.disc?.glowColor ?? DEFAULT_SUNLIGHT.disc.glowColor,
			coreIntensity: options?.disc?.coreIntensity ?? DEFAULT_SUNLIGHT.disc.coreIntensity,
			glowIntensity: options?.disc?.glowIntensity ?? DEFAULT_SUNLIGHT.disc.glowIntensity,
			softness: options?.disc?.softness ?? DEFAULT_SUNLIGHT.disc.softness,
		},
		fog: {
			color: options?.fog?.color ?? DEFAULT_SUNLIGHT.fog.color,
			density: options?.fog?.density ?? DEFAULT_SUNLIGHT.fog.density,
			heightFalloff: options?.fog?.heightFalloff ?? DEFAULT_SUNLIGHT.fog.heightFalloff,
		},
		shadow: {
			enabled: options?.shadow?.enabled ?? DEFAULT_SUNLIGHT.shadow.enabled,
			mapSize: options?.shadow?.mapSize ?? DEFAULT_SUNLIGHT.shadow.mapSize,
			bias: options?.shadow?.bias ?? DEFAULT_SUNLIGHT.shadow.bias,
			normalBias: options?.shadow?.normalBias ?? DEFAULT_SUNLIGHT.shadow.normalBias,
			intensity: options?.shadow?.intensity ?? DEFAULT_SUNLIGHT.shadow.intensity,
			softness: options?.shadow?.softness ?? DEFAULT_SUNLIGHT.shadow.softness,
			frustumSize: options?.shadow?.frustumSize ?? DEFAULT_SUNLIGHT.shadow.frustumSize,
		},
		postProcess: {
			enabled: options?.postProcess?.enabled ?? DEFAULT_SUNLIGHT.postProcess.enabled,
			ao: {
				enabled: options?.postProcess?.ao?.enabled ?? DEFAULT_SUNLIGHT.postProcess.ao.enabled,
				intensity: options?.postProcess?.ao?.intensity ?? DEFAULT_SUNLIGHT.postProcess.ao.intensity,
				radius: options?.postProcess?.ao?.radius ?? DEFAULT_SUNLIGHT.postProcess.ao.radius,
				samples: options?.postProcess?.ao?.samples ?? DEFAULT_SUNLIGHT.postProcess.ao.samples,
			},
			bloom: {
				enabled: options?.postProcess?.bloom?.enabled ?? DEFAULT_SUNLIGHT.postProcess.bloom.enabled,
				threshold: options?.postProcess?.bloom?.threshold ?? DEFAULT_SUNLIGHT.postProcess.bloom.threshold,
				intensity: options?.postProcess?.bloom?.intensity ?? DEFAULT_SUNLIGHT.postProcess.bloom.intensity,
				radius: options?.postProcess?.bloom?.radius ?? DEFAULT_SUNLIGHT.postProcess.bloom.radius,
			},
			godRays: {
				enabled: options?.postProcess?.godRays?.enabled ?? DEFAULT_SUNLIGHT.postProcess.godRays.enabled,
				intensity: options?.postProcess?.godRays?.intensity ?? DEFAULT_SUNLIGHT.postProcess.godRays.intensity,
				decay: options?.postProcess?.godRays?.decay ?? DEFAULT_SUNLIGHT.postProcess.godRays.decay,
				density: options?.postProcess?.godRays?.density ?? DEFAULT_SUNLIGHT.postProcess.godRays.density,
				samples: options?.postProcess?.godRays?.samples ?? DEFAULT_SUNLIGHT.postProcess.godRays.samples,
			},
		},
	}
}

function meshToBufferGeometry(mesh: Mesh) {
	const geometry = new THREE.BufferGeometry()

	if (mesh.quads.length === 0) {
		return geometry
	}

	const positions: number[] = []
	const normals: number[] = []
	const uvs: number[] = []
	const colors: number[] = []
	const texLimits: number[] = []
	const blockPositions: number[] = []
	const emissives: number[] = []
	const indices: number[] = []

	let offset = 0
	for (const quad of mesh.quads) {
		const verts = quad.vertices()
		for (const v of verts) {
			positions.push(v.pos.x, v.pos.y, v.pos.z)
			const normal = v.normal ?? quad.normal()
			normals.push(normal.x, normal.y, normal.z)
			uvs.push(v.texture?.[0] ?? 0, v.texture?.[1] ?? 0)
			if (v.textureLimit) {
				texLimits.push(v.textureLimit[0], v.textureLimit[1], v.textureLimit[2], v.textureLimit[3])
			} else {
				texLimits.push(0, 0, 0, 0)
			}
			const color = v.color ?? [1, 1, 1]
			colors.push(color[0], color[1], color[2])
			const pos = v.blockPos ?? v.pos
			blockPositions.push(pos.x, pos.y, pos.z)
			emissives.push(v.emissive ?? 0)
		}
		indices.push(
			offset, offset + 1, offset + 2,
			offset, offset + 2, offset + 3,
		)
		offset += 4
	}

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
	geometry.setAttribute('texLimit', new THREE.Float32BufferAttribute(texLimits, 4))
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
	geometry.setAttribute('blockPos', new THREE.Float32BufferAttribute(blockPositions, 3))
	geometry.setAttribute('emissive', new THREE.Float32BufferAttribute(emissives, 1))
	const indexArray = indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
	geometry.setIndex(new THREE.BufferAttribute(indexArray, 1))
	geometry.computeBoundingSphere()
	return geometry
}

function meshToLineGeometry(mesh: Mesh) {
	const geometry = new THREE.BufferGeometry()
	if (mesh.lines.length === 0) {
		return geometry
	}
	const positions: number[] = []
	const colors: number[] = []
	for (const line of mesh.lines) {
		line.vertices().forEach(v => {
			positions.push(v.pos.x, v.pos.y, v.pos.z)
			const color = v.color ?? [1, 1, 1]
			colors.push(color[0], color[1], color[2])
		})
	}
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
	geometry.computeBoundingSphere()
	return geometry
}

export class ThreeStructureRenderer {
	private readonly renderer: THREE.WebGLRenderer
	private readonly structureScene: THREE.Scene
	private readonly skyScene: THREE.Scene
	private readonly overlayScene: THREE.Scene
	private readonly camera: THREE.PerspectiveCamera
	private readonly skyCamera: THREE.Camera
	private readonly atlasTexture: THREE.DataTexture
	private readonly opaqueMaterial: THREE.RawShaderMaterial
	private readonly transparentMaterial: THREE.RawShaderMaterial
	private readonly coloredMaterial: THREE.RawShaderMaterial
	private readonly lineMaterial: THREE.LineBasicMaterial
	private readonly skyMaterial: THREE.ShaderMaterial
	private readonly shadowDepthMaterial: THREE.RawShaderMaterial
	private shadowMap: THREE.WebGLRenderTarget | null = null
	private readonly shadowCamera: THREE.OrthographicCamera
	private sunlight: SunlightSettings
	private skyMesh?: THREE.Mesh
	private sunDisc?: THREE.Mesh

	// Post-processing
	private sceneTarget: THREE.WebGLRenderTarget | null = null
	private depthTarget: THREE.WebGLRenderTarget | null = null
	private bloomBrightTarget: THREE.WebGLRenderTarget | null = null
	private bloomBlurTarget1: THREE.WebGLRenderTarget | null = null
	private bloomBlurTarget2: THREE.WebGLRenderTarget | null = null
	private godRaysTarget: THREE.WebGLRenderTarget | null = null
	private aoTarget: THREE.WebGLRenderTarget | null = null
	private postProcessQuad: THREE.Mesh | null = null
	private ssaoMaterial: THREE.ShaderMaterial | null = null
	private bloomBrightMaterial: THREE.ShaderMaterial | null = null
	private bloomBlurMaterial: THREE.ShaderMaterial | null = null
	private godRaysMaterial: THREE.ShaderMaterial | null = null
	private compositeMaterial: THREE.ShaderMaterial | null = null

	private readonly chunkBuilder: ChunkBuilder
	private chunkMeshes: THREE.Mesh[] = []
	private grid?: THREE.LineSegments
	private invisibleBlocks?: THREE.LineSegments
	private outline?: THREE.LineSegments
	private readonly chunkSize: vec3
	private targetCenter: vec3

	public useInvisibleBlocks: boolean
	private readonly drawDistance?: number
	private pixelSize: number

	constructor(
		canvas: HTMLCanvasElement,
		private structure: StructureProvider,
		private readonly resources: Resources,
		options?: ThreeStructureRendererOptions,
	) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: false,
			antialias: true,
			preserveDrawingBuffer: true,
		})
		this.renderer.autoClear = false
		this.renderer.setClearColor(0x000000, 1)

		this.structureScene = new THREE.Scene()
		this.skyScene = new THREE.Scene()
		this.overlayScene = new THREE.Scene()

		this.camera = new THREE.PerspectiveCamera(70, (canvas.clientWidth || 1) / (canvas.clientHeight || 1), 0.1, 500)
		// Orthographic camera for fullscreen sky quad
		this.skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
		// Orthographic camera for directional light shadow mapping
		this.shadowCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 200)

		const gl = this.renderer.getContext() as WebGLRenderingContext
		const chunkSize = options?.chunkSize ?? 16
		this.chunkSize = typeof chunkSize === 'number' ? [chunkSize, chunkSize, chunkSize] : chunkSize
		this.targetCenter = vec3.fromValues(
			(this.structure.getSize()[0] ?? 0) / 2,
			(this.structure.getSize()[1] ?? 0) / 2,
			(this.structure.getSize()[2] ?? 0) / 2
		)
		this.chunkBuilder = new ChunkBuilder(gl, structure, resources, chunkSize)
		this.useInvisibleBlocks = options?.useInvisibleBlockBuffer ?? false
		this.drawDistance = options?.drawDistance
		this.sunlight = buildSunlightSettings(options?.sunlight)

		this.atlasTexture = this.createAtlasTexture(this.resources.getTextureAtlas())
		this.pixelSize = this.resources.getPixelSize?.() ?? 0

		this.shadowDepthMaterial = this.createShadowDepthMaterial()
		this.initShadowMap()
		this.opaqueMaterial = this.createStructureMaterial(false)
		this.transparentMaterial = this.createStructureMaterial(true)
		this.coloredMaterial = this.createColoredMaterial()
		this.lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: true })
		this.skyMaterial = this.createSkyMaterial()

		// Quick debug for atlas contents
		const atlasImage = this.resources.getTextureAtlas()
		const alphaSample = Array.from(atlasImage.data.slice(3, 3 + 400 * 4)).filter((_, i) => i % 4 === 0)
		const nonZeroAlpha = alphaSample.filter(a => a !== 0).length
		console.log('[ThreeStructureRenderer] atlas info', {
			width: atlasImage.width,
			height: atlasImage.height,
			alphaSampleNonZero: nonZeroAlpha,
		})

		this.rebuildChunkObjects()
		this.grid = this.createGrid()
		if (this.grid) this.overlayScene.add(this.grid)
		if (this.useInvisibleBlocks) {
			this.invisibleBlocks = this.createInvisibleBlocks()
			if (this.invisibleBlocks) this.overlayScene.add(this.invisibleBlocks)
		}
		this.sunDisc = this.createSunDisc()
		if (this.sunDisc) this.overlayScene.add(this.sunDisc)

		// Create fullscreen sky quad
		this.skyMesh = this.createSkyMesh()
		if (this.skyMesh) this.skyScene.add(this.skyMesh)

		// Initialize post-processing
		this.initPostProcessing(canvas.width || 800, canvas.height || 600)
	}

	public setViewport(x: number, y: number, width: number, height: number) {
		this.renderer.setViewport(x, y, width, height)
		this.renderer.setSize(width, height, true)
		this.camera.aspect = width / Math.max(height, 1)
		this.camera.updateProjectionMatrix()
		// Resize post-processing targets
		this.resizePostProcessTargets(width, height)
	}

	public setStructure(structure: StructureProvider) {
		this.structure = structure
		this.targetCenter = vec3.fromValues(
			(this.structure.getSize()[0] ?? 0) / 2,
			(this.structure.getSize()[1] ?? 0) / 2,
			(this.structure.getSize()[2] ?? 0) / 2
		)
		this.chunkBuilder.setStructure(structure)
		this.rebuildChunkObjects()
		this.rebuildOverlay()
	}

	public updateStructureBuffers(chunkPositions?: vec3[]): void {
		this.chunkBuilder.updateStructureBuffers(chunkPositions)
		this.rebuildChunkObjects()
		this.rebuildOverlay()
	}

	public drawStructure(viewMatrix: mat4) {
		this.prepareCamera(viewMatrix)
		this.positionSunDisc(viewMatrix)
		this.updateSkyUniforms(viewMatrix)

		// 0. Render shadow map first
		this.renderShadowPass()

		// Try post-processing pipeline
		if (this.renderPostProcessing(viewMatrix)) {
			return
		}

		// Fallback: direct rendering without post-processing
		this.renderer.clear()

		// 1. Render sky background (fullscreen quad, no depth)
		this.renderer.render(this.skyScene, this.skyCamera)

		// 2. Render structure with shadows
		this.structureScene.overrideMaterial = null
		this.renderer.render(this.structureScene, this.camera)

		// 3. Render sun disc overlay (only sun, no grid/outline)
		this.setOverlayVisibility({ grid: false, invisible: false, outline: false, sunDisc: true })
		this.renderer.render(this.overlayScene, this.camera)
	}

	public drawColoredStructure(viewMatrix: mat4) {
		this.prepareCamera(viewMatrix)
		this.positionSunDisc(viewMatrix)
		this.renderer.clear()
		this.structureScene.overrideMaterial = this.coloredMaterial
		this.renderer.render(this.structureScene, this.camera)
		this.structureScene.overrideMaterial = null
	}

	public drawGrid(viewMatrix: mat4) {
		if (!this.grid) return
		this.prepareCamera(viewMatrix)
		this.positionSunDisc(viewMatrix)
		this.setOverlayVisibility({ grid: true, invisible: false, outline: false })
		this.renderer.render(this.overlayScene, this.camera)
	}

	public drawInvisibleBlocks(viewMatrix: mat4) {
		if (!this.useInvisibleBlocks || !this.invisibleBlocks) return
		this.prepareCamera(viewMatrix)
		this.setOverlayVisibility({ grid: false, invisible: true, outline: false })
		this.renderer.render(this.overlayScene, this.camera)
	}

	public drawOutline(viewMatrix: mat4, pos: vec3) {
		if (!this.outline) {
			this.outline = this.createOutline()
			this.overlayScene.add(this.outline)
		}
		this.outline.position.set(pos[0], pos[1], pos[2])
		this.prepareCamera(viewMatrix)
		this.setOverlayVisibility({ grid: false, invisible: false, outline: true })
		this.renderer.render(this.overlayScene, this.camera)
	}

	public dispose() {
		this.chunkMeshes.forEach(mesh => {
			mesh.geometry.dispose()
		})
		this.atlasTexture.dispose()
		this.opaqueMaterial.dispose()
		this.transparentMaterial.dispose()
		this.coloredMaterial.dispose()
		this.lineMaterial.dispose()
		this.skyMaterial.dispose()
		this.shadowDepthMaterial.dispose()
		this.shadowMap?.dispose()
		this.grid?.geometry.dispose()
		this.invisibleBlocks?.geometry.dispose()
		this.outline?.geometry.dispose()
		this.skyMesh?.geometry.dispose()
		this.sunDisc?.geometry.dispose()
		;(this.sunDisc?.material as THREE.Material)?.dispose()
		// Post-processing cleanup
		this.sceneTarget?.dispose()
		this.depthTarget?.dispose()
		this.bloomBrightTarget?.dispose()
		this.bloomBlurTarget1?.dispose()
		this.bloomBlurTarget2?.dispose()
		this.godRaysTarget?.dispose()
		this.aoTarget?.dispose()
		this.postProcessQuad?.geometry.dispose()
		this.ssaoMaterial?.dispose()
		this.bloomBrightMaterial?.dispose()
		this.bloomBlurMaterial?.dispose()
		this.godRaysMaterial?.dispose()
		this.compositeMaterial?.dispose()
		this.renderer.dispose()
	}

	private prepareCamera(viewMatrix: mat4) {
		const camPos = this.getCameraPosition(viewMatrix) ?? vec3.fromValues(0, 0, 10)
		this.camera.position.set(camPos[0], camPos[1], camPos[2])
		this.camera.up.set(0, 1, 0)
		this.camera.lookAt(this.targetCenter[0], this.targetCenter[1], this.targetCenter[2])
		this.camera.updateMatrixWorld(true)

		if (this.drawDistance) {
			this.applyDrawDistance(camPos, this.drawDistance)
		} else {
			this.chunkMeshes.forEach(mesh => mesh.visible = true)
		}
	}

	private rebuildChunkObjects() {
		this.chunkMeshes.forEach(mesh => {
			this.structureScene.remove(mesh)
			mesh.geometry.dispose()
		})
		this.chunkMeshes = []

		const meshes = this.chunkBuilder.getMeshEntries()
		meshes.forEach((entry, idx) => {
			if (entry.mesh.isEmpty()) return
			const geometry = meshToBufferGeometry(entry.mesh)
			const material = entry.transparent ? this.transparentMaterial : this.opaqueMaterial
			const mesh = new THREE.Mesh(geometry, material)
			mesh.renderOrder = entry.transparent ? 1 : 0
			mesh.userData.origin = entry.origin
			this.structureScene.add(mesh)
			this.chunkMeshes.push(mesh)
			if (idx === 0) {
				console.log('[ThreeStructureRenderer] chunk geometry sample', {
					vertices: geometry.getAttribute('position')?.count ?? 0,
					indices: geometry.getIndex()?.count ?? 0,
					transparent: entry.transparent,
				})
			}
		})

		console.log('[ThreeStructureRenderer] rebuilt chunks', {
			count: this.chunkMeshes.length,
		})
	}

	private rebuildOverlay() {
		if (this.grid) {
			this.overlayScene.remove(this.grid)
			this.grid.geometry.dispose()
		}
		this.grid = this.createGrid()
		if (this.grid) this.overlayScene.add(this.grid)

		if (this.invisibleBlocks) {
			this.overlayScene.remove(this.invisibleBlocks)
			this.invisibleBlocks.geometry.dispose()
		}
		if (this.useInvisibleBlocks) {
			this.invisibleBlocks = this.createInvisibleBlocks()
			if (this.invisibleBlocks) this.overlayScene.add(this.invisibleBlocks)
		}

		if (this.outline) {
			this.overlayScene.remove(this.outline)
			this.outline.geometry.dispose()
			this.outline = undefined
		}

		if (this.sunDisc) {
			this.overlayScene.remove(this.sunDisc)
			this.sunDisc.geometry.dispose()
			;(this.sunDisc.material as THREE.Material).dispose()
		}
		this.sunDisc = this.createSunDisc()
		if (this.sunDisc) this.overlayScene.add(this.sunDisc)
	}

	private createStructureMaterial(transparent: boolean) {
		return new THREE.RawShaderMaterial({
			name: transparent ? 'deepslate-structure-transparent' : 'deepslate-structure-opaque',
			vertexShader: `
				precision highp float;
				uniform mat4 projectionMatrix;
				uniform mat4 modelViewMatrix;
				uniform mat4 modelMatrix;
				uniform mat3 normalMatrix;
				uniform mat4 shadowMatrix;
				attribute vec3 position;
				attribute vec2 uv;
				attribute vec4 texLimit;
				attribute vec3 color;
				attribute vec3 normal;
				attribute float emissive;

				varying highp vec2 vTexCoord;
				varying highp vec4 vTexLimit;
				varying highp vec3 vTintColor;
				varying highp vec3 vNormal;
				varying highp vec4 vShadowCoord;
				varying highp vec3 vWorldPos;
				varying highp float vEmissive;

				void main(void) {
					vTexCoord = uv;
					vTexLimit = texLimit;
					vTintColor = color;
					vNormal = normalize(normalMatrix * normal);
					vEmissive = emissive;

					vec4 worldPos = modelMatrix * vec4(position, 1.0);
					vWorldPos = worldPos.xyz;
					vShadowCoord = shadowMatrix * worldPos;

					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;
				varying highp vec2 vTexCoord;
				varying highp vec4 vTexLimit;
				varying highp vec3 vTintColor;
				varying highp vec3 vNormal;
				varying highp vec4 vShadowCoord;
				varying highp vec3 vWorldPos;
				varying highp float vEmissive;

				uniform sampler2D atlas;
				uniform sampler2D shadowMap;
				uniform highp float pixelSize;
				uniform highp vec3 sunDirection;
				uniform highp vec3 sunColor;
				uniform highp vec3 ambientColor;
				uniform highp vec3 fillColor;
				uniform highp vec3 rimColor;
				uniform highp float sunIntensity;
				uniform highp float ambientIntensity;
				uniform highp float fillIntensity;
				uniform highp float rimIntensity;
				uniform highp float horizonFalloff;
				uniform highp float exposure;
				uniform highp vec3 fogColor;
				uniform highp float fogDensity;
				uniform highp float fogHeightFalloff;
				uniform highp float shadowBias;
				uniform highp float shadowNormalBias;
				uniform highp float shadowIntensity;
				uniform highp float shadowSoftness;
				uniform highp vec2 shadowMapSize;
				uniform bool shadowEnabled;

				float sampleShadow(vec2 uv, float compare) {
					float depth = texture2D(shadowMap, uv).r;
					return step(compare, depth);
				}

				float calcShadow(vec4 shadowCoord, vec3 normal) {
					if (!shadowEnabled) return 1.0;

					vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
					projCoords = projCoords * 0.5 + 0.5;

					// Out of shadow frustum
					if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
						projCoords.y < 0.0 || projCoords.y > 1.0 ||
						projCoords.z > 1.0) {
						return 1.0;
					}

					// Apply normal bias
					float cosTheta = max(dot(normal, normalize(sunDirection)), 0.0);
					float bias = shadowBias + shadowNormalBias * (1.0 - cosTheta);
					float currentDepth = projCoords.z - bias;

					// PCF soft shadows
					float shadow = 0.0;
					vec2 texelSize = shadowSoftness / shadowMapSize;

					for (float x = -1.5; x <= 1.5; x += 1.0) {
						for (float y = -1.5; y <= 1.5; y += 1.0) {
							shadow += sampleShadow(projCoords.xy + vec2(x, y) * texelSize, currentDepth);
						}
					}
					shadow /= 16.0;

					// Blend shadow with intensity
					return mix(1.0 - shadowIntensity, 1.0, shadow);
				}

				void main(void) {
					vec2 clampedUv = clamp(vTexCoord,
						vTexLimit.xy + vec2(0.5, 0.5) * pixelSize,
						vTexLimit.zw - vec2(0.5, 0.5) * pixelSize
					);
					vec4 texColor = texture2D(atlas, clampedUv);
					if(texColor.a < 0.01) discard;

					vec3 normal = normalize(vNormal);
					vec3 lightDir = normalize(sunDirection);

					// Shadow calculation
					float shadow = calcShadow(vShadowCoord, normal);

					float ndl = max(dot(normal, lightDir), 0.0);
					float wrapped = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
					float sunTerm = pow(wrapped, 1.35) * sunIntensity * shadow;

					float backFill = pow(1.0 - wrapped, 2.2) * fillIntensity;
					float skyMix = smoothstep(0.0, max(horizonFalloff, 0.0001), normal.y * 0.5 + 0.5);
					vec3 ambient = mix(fillColor, ambientColor, skyMix) * ambientIntensity;

					float rim = pow(1.0 - max(dot(normal, lightDir), 0.0), 3.0) * rimIntensity * shadow;

					vec3 lighting = ambient + sunColor * sunTerm + fillColor * backFill + rimColor * rim;
					vec3 baseColor = texColor.xyz * vTintColor;
					vec3 finalColor = baseColor * lighting * exposure;

					// Add emissive contribution (subtle glow for bloom effect)
					vec3 emissiveContrib = baseColor * vEmissive * 0.8;
					finalColor = finalColor + emissiveContrib;

					// Height + distance fog approximated in view space
					float depth = gl_FragCoord.z / gl_FragCoord.w;
					float fog = 1.0 - exp(-depth * fogDensity - max(0.0, vTexCoord.y) * fogHeightFalloff);
					fog = clamp(fog, 0.0, 1.0);
					// Slightly reduce fog on emissive blocks
					vec3 fogged = mix(finalColor, fogColor, fog * (1.0 - vEmissive * 0.3));

					gl_FragColor = vec4(fogged, texColor.a);
				}
			`,
			uniforms: this.createStructureUniforms(),
			transparent,
			depthWrite: !transparent,
			depthTest: true,
			alphaTest: 0.01,
			side: THREE.FrontSide,
		})
	}

	private createStructureUniforms(): Record<string, THREE.IUniform> {
		const makeColor = (color: Color) => new THREE.Color(color[0], color[1], color[2])
		const direction = new THREE.Vector3(this.sunlight.direction[0], this.sunlight.direction[1], this.sunlight.direction[2])
		if (direction.lengthSq() === 0) {
			direction.set(0, 1, 0)
		}
		direction.normalize()

		return {
			atlas: { value: this.atlasTexture },
			pixelSize: { value: this.pixelSize },
			sunDirection: { value: direction },
			sunColor: { value: makeColor(this.sunlight.color) },
			ambientColor: { value: makeColor(this.sunlight.ambientColor) },
			fillColor: { value: makeColor(this.sunlight.fillColor) },
			rimColor: { value: makeColor(this.sunlight.rimColor) },
			sunIntensity: { value: this.sunlight.intensity },
			ambientIntensity: { value: this.sunlight.ambientIntensity },
			fillIntensity: { value: this.sunlight.fillIntensity },
			rimIntensity: { value: this.sunlight.rimIntensity },
			horizonFalloff: { value: this.sunlight.horizonFalloff },
			exposure: { value: this.sunlight.exposure },
			fogColor: { value: makeColor(this.sunlight.fog.color) },
			fogDensity: { value: this.sunlight.fog.density },
			fogHeightFalloff: { value: this.sunlight.fog.heightFalloff },
			// Shadow uniforms
			shadowMap: { value: this.shadowMap?.texture ?? null },
			shadowMatrix: { value: new THREE.Matrix4() },
			shadowBias: { value: this.sunlight.shadow.bias },
			shadowNormalBias: { value: this.sunlight.shadow.normalBias },
			shadowIntensity: { value: this.sunlight.shadow.intensity },
			shadowSoftness: { value: this.sunlight.shadow.softness },
			shadowMapSize: { value: new THREE.Vector2(this.sunlight.shadow.mapSize, this.sunlight.shadow.mapSize) },
			shadowEnabled: { value: this.sunlight.shadow.enabled },
		}
	}

	public setSunlight(sunlight?: SunlightOptions) {
		const merged: SunlightOptions = {
			...this.sunlight,
			...(sunlight ?? {}),
			direction: sunlight?.direction ?? this.sunlight.direction,
		}
		this.sunlight = buildSunlightSettings(merged)
		this.applySunlightUniforms(this.opaqueMaterial)
		this.applySunlightUniforms(this.transparentMaterial)
		this.applySkyUniforms()
	}

	private applySkyUniforms() {
		const uniforms = this.skyMaterial.uniforms
		if (!uniforms) return

		const setColor = (key: string, color: Color) => {
			const uniform = uniforms[key]
			if (uniform?.value instanceof THREE.Color) {
				uniform.value.setRGB(color[0], color[1], color[2])
			}
		}

		const dir = uniforms.sunDirection?.value as THREE.Vector3 | undefined
		if (dir) {
			dir.set(
				this.sunlight.direction[0],
				this.sunlight.direction[1],
				this.sunlight.direction[2]
			).normalize()
		}

		setColor('zenithColor', this.sunlight.sky.zenithColor)
		setColor('horizonColor', this.sunlight.sky.horizonColor)
		setColor('groundColor', this.sunlight.sky.groundColor)
		setColor('sunGlowColor', this.sunlight.sky.sunGlowColor)

		if (uniforms.sunGlowIntensity) uniforms.sunGlowIntensity.value = this.sunlight.sky.sunGlowIntensity
		if (uniforms.sunGlowExponent) uniforms.sunGlowExponent.value = this.sunlight.sky.sunGlowExponent
	}

	private applySunlightUniforms(material: THREE.RawShaderMaterial) {
		const uniforms = material.uniforms
		if (!uniforms) return

		const setColor = (key: string, color: Color) => {
			const uniform = uniforms[key]
			if (uniform?.value instanceof THREE.Color) {
				uniform.value.setRGB(color[0], color[1], color[2])
			}
		}

		const dir = uniforms.sunDirection?.value as THREE.Vector3 | undefined
		if (dir) {
			dir.set(this.sunlight.direction[0], this.sunlight.direction[1], this.sunlight.direction[2]).normalize()
		}

		setColor('sunColor', this.sunlight.color)
		setColor('ambientColor', this.sunlight.ambientColor)
		setColor('fillColor', this.sunlight.fillColor)
		setColor('rimColor', this.sunlight.rimColor)
		setColor('fogColor', this.sunlight.fog.color)

		if (uniforms.sunIntensity) uniforms.sunIntensity.value = this.sunlight.intensity
		if (uniforms.ambientIntensity) uniforms.ambientIntensity.value = this.sunlight.ambientIntensity
		if (uniforms.fillIntensity) uniforms.fillIntensity.value = this.sunlight.fillIntensity
		if (uniforms.rimIntensity) uniforms.rimIntensity.value = this.sunlight.rimIntensity
		if (uniforms.horizonFalloff) uniforms.horizonFalloff.value = this.sunlight.horizonFalloff
		if (uniforms.exposure) uniforms.exposure.value = this.sunlight.exposure
		if (uniforms.fogDensity) uniforms.fogDensity.value = this.sunlight.fog.density
		if (uniforms.fogHeightFalloff) uniforms.fogHeightFalloff.value = this.sunlight.fog.heightFalloff
	}

	private createColoredMaterial() {
		return new THREE.RawShaderMaterial({
			name: 'deepslate-structure-colored',
			vertexShader: `
				precision highp float;
				uniform mat4 projectionMatrix;
				uniform mat4 modelViewMatrix;
				attribute vec3 position;
				attribute vec3 blockPos;
			
				varying highp vec3 vColor;
			
				void main(void) {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					vColor = blockPos / 256.0;
				}
			`,
			fragmentShader: `
				precision highp float;
			
				varying highp vec3 vColor;
			
				void main(void) {
					gl_FragColor = vec4(vColor, 1.0);
				}
			`,
			transparent: false,
			depthWrite: true,
			depthTest: true,
			side: THREE.FrontSide,
		})
	}

	private createGrid() {
		const [X, Y, Z] = this.structure.getSize()
		const mesh = new Mesh()
		mesh.addLine(0, 0, 0, X, 0, 0, [1, 0, 0])
		mesh.addLine(0, 0, 0, 0, 0, Z, [0, 0, 1])

		const c: Color = [0.8, 0.8, 0.8]
		mesh.addLine(0, 0, 0, 0, Y, 0, c)
		mesh.addLine(X, 0, 0, X, Y, 0, c)
		mesh.addLine(0, 0, Z, 0, Y, Z, c)
		mesh.addLine(X, 0, Z, X, Y, Z, c)

		mesh.addLine(0, Y, 0, 0, Y, Z, c)
		mesh.addLine(X, Y, 0, X, Y, Z, c)
		mesh.addLine(0, Y, 0, X, Y, 0, c)
		mesh.addLine(0, Y, Z, X, Y, Z, c)

		const maxLines = 128
		const stepX = Math.max(1, Math.ceil(X / maxLines))
		const stepZ = Math.max(1, Math.ceil(Z / maxLines))

		for (let x = stepX; x <= X; x += stepX) mesh.addLine(x, 0, 0, x, 0, Z, c)
		for (let z = stepZ; z <= Z; z += stepZ) mesh.addLine(0, 0, z, X, 0, z, c)

		const geometry = meshToLineGeometry(mesh)
		return geometry.attributes.position ? new THREE.LineSegments(geometry, this.lineMaterial) : undefined
	}

	private createOutline() {
		const mesh = new Mesh()
		mesh.addLineCube(0, 0, 0, 1, 1, 1, [1, 1, 1])
		const geometry = meshToLineGeometry(mesh)
		return new THREE.LineSegments(geometry, this.lineMaterial)
	}

	private createInvisibleBlocks() {
		const mesh = new Mesh()
		if (!this.useInvisibleBlocks) {
			return undefined
		}

		const size = this.structure.getSize()
		const volume = size[0] * size[1] * size[2]
		if (volume > 200_000) {
			console.warn('[ThreeStructureRenderer] Skipping invisible blocks buffer for large structure', { volume })
			return undefined
		}

		for (let x = 0; x < size[0]; x += 1) {
			for (let y = 0; y < size[1]; y += 1) {
				for (let z = 0; z < size[2]; z += 1) {
					const block = this.structure.getBlock([x, y, z])
					if (block === undefined) continue
					if (block === null) {
						mesh.addLineCube(x + 0.4375, y + 0.4375, z + 0.4375, x + 0.5625, y + 0.5625, z + 0.5625, [1, 0.25, 0.25])
					} else if (block.state.is(BlockState.AIR)) {
						mesh.addLineCube(x + 0.375, y + 0.375, z + 0.375, x + 0.625, y + 0.625, z + 0.625, [0.5, 0.5, 1])
					} else if (block.state.is(new BlockState('cave_air'))) {
						mesh.addLineCube(x + 0.375, y + 0.375, z + 0.375, x + 0.625, y + 0.625, z + 0.625, [0.5, 1, 0.5])
					}
				}
			}
		}

		const geometry = meshToLineGeometry(mesh)
		return geometry.attributes.position ? new THREE.LineSegments(geometry, this.lineMaterial) : undefined
	}

	private setOverlayVisibility(flags: { grid: boolean, invisible: boolean, outline: boolean, sunDisc?: boolean }) {
		if (this.grid) this.grid.visible = flags.grid
		if (this.invisibleBlocks) this.invisibleBlocks.visible = flags.invisible
		if (this.outline) this.outline.visible = flags.outline
		if (this.sunDisc) this.sunDisc.visible = flags.sunDisc ?? false
	}

	private createAtlasTexture(image: ImageData) {
		const texture = new THREE.DataTexture(image.data, image.width, image.height, THREE.RGBAFormat)
		texture.magFilter = THREE.NearestFilter
		texture.minFilter = THREE.NearestFilter
		texture.wrapS = THREE.ClampToEdgeWrapping
		texture.wrapT = THREE.ClampToEdgeWrapping
		texture.flipY = false
		texture.generateMipmaps = false
		texture.needsUpdate = true
		return texture
	}

	private getCameraPosition(viewMatrix: mat4): vec3 | null {
		const inv = mat4.create()
		if (!mat4.invert(inv, viewMatrix)) {
			return null
		}
		return vec3.fromValues(inv[12], inv[13], inv[14])
	}

	private applyDrawDistance(cameraPos: vec3, maxDistance: number) {
		const maxDistanceSq = maxDistance * maxDistance
		for (const mesh of this.chunkMeshes) {
			const origin = mesh.userData.origin as vec3 | undefined
			if (!origin) {
				mesh.visible = true
				continue
			}
			const center: vec3 = [
				origin[0] + this.chunkSize[0] * 0.5,
				origin[1] + this.chunkSize[1] * 0.5,
				origin[2] + this.chunkSize[2] * 0.5,
			]
			const dx = center[0] - cameraPos[0]
			const dy = center[1] - cameraPos[1]
			const dz = center[2] - cameraPos[2]
			mesh.visible = dx*dx + dy*dy + dz*dz <= maxDistanceSq
		}
	}

	private positionSunDisc(viewMatrix: mat4) {
		if (!this.sunDisc) return
		const camPos = this.getCameraPosition(viewMatrix) ?? vec3.fromValues(0, 0, 10)
		const dir = vec3.clone(this.sunlight.direction)
		vec3.normalize(dir, dir)

		const distance = this.sunlight.disc.distance
		const target = vec3.create()
		vec3.scaleAndAdd(target, camPos, dir, distance)

		this.sunDisc.position.set(target[0], target[1], target[2])
		this.sunDisc.scale.setScalar(this.sunlight.disc.size)
		this.sunDisc.lookAt(camPos[0], camPos[1], camPos[2])
	}

	private createSunDisc() {
		const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
		const material = new THREE.ShaderMaterial({
			name: 'deepslate-sun-disc',
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: THREE.DoubleSide,
			uniforms: {
				coreColor: { value: new THREE.Color(...this.sunlight.disc.coreColor) },
				glowColor: { value: new THREE.Color(...this.sunlight.disc.glowColor) },
				coreIntensity: { value: this.sunlight.disc.coreIntensity },
				glowIntensity: { value: this.sunlight.disc.glowIntensity },
				softness: { value: this.sunlight.disc.softness },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv * 2.0 - 1.0;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;
				varying vec2 vUv;
				uniform vec3 coreColor;
				uniform vec3 glowColor;
				uniform float coreIntensity;
				uniform float glowIntensity;
				uniform float softness;

				void main() {
					// Square distance (Chebyshev/chessboard distance)
					float sqDist = max(abs(vUv.x), abs(vUv.y));

					// Sharp square core
					float core = 1.0 - smoothstep(0.25, 0.3, sqDist);

					// Very diffuse glow - exponential falloff for natural light scatter
					float r = length(vUv);
					float glow = exp(-r * r * 0.8) * 0.6;

					vec3 color = coreColor * core * coreIntensity + glowColor * glow * glowIntensity;
					float alpha = clamp(core + glow * 0.3, 0.0, 1.0);
					gl_FragColor = vec4(color, alpha);
				}
			`,
		})

		const mesh = new THREE.Mesh(geometry, material)
		mesh.renderOrder = 10
		return mesh
	}

	private createSkyMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			name: 'deepslate-sky',
			transparent: false,
			depthWrite: false,
			depthTest: false,
			side: THREE.FrontSide,
			uniforms: {
				sunDirection: { value: new THREE.Vector3(
					this.sunlight.direction[0],
					this.sunlight.direction[1],
					this.sunlight.direction[2]
				).normalize() },
				zenithColor: { value: new THREE.Color(...this.sunlight.sky.zenithColor) },
				horizonColor: { value: new THREE.Color(...this.sunlight.sky.horizonColor) },
				groundColor: { value: new THREE.Color(...this.sunlight.sky.groundColor) },
				sunGlowColor: { value: new THREE.Color(...this.sunlight.sky.sunGlowColor) },
				sunGlowIntensity: { value: this.sunlight.sky.sunGlowIntensity },
				sunGlowExponent: { value: this.sunlight.sky.sunGlowExponent },
				invViewMatrix: { value: new THREE.Matrix4() },
				invProjectionMatrix: { value: new THREE.Matrix4() },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.9999, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;
				varying vec2 vUv;

				uniform vec3 sunDirection;
				uniform vec3 zenithColor;
				uniform vec3 horizonColor;
				uniform vec3 groundColor;
				uniform vec3 sunGlowColor;
				uniform float sunGlowIntensity;
				uniform float sunGlowExponent;
				uniform mat4 invViewMatrix;
				uniform mat4 invProjectionMatrix;

				void main() {
					// Convert UV to clip space coordinates
					vec2 ndc = vUv * 2.0 - 1.0;

					// Reconstruct view ray in clip space
					vec4 clipPos = vec4(ndc, 1.0, 1.0);
					vec4 viewPos = invProjectionMatrix * clipPos;
					viewPos /= viewPos.w;

					// Transform to world space direction
					vec4 worldPos = invViewMatrix * vec4(viewPos.xyz, 0.0);
					vec3 rayDir = normalize(worldPos.xyz);

					// Vertical gradient: zenith (up) to horizon to ground
					float elevation = rayDir.y;

					// Sky gradient above horizon
					float horizonBlend = 1.0 - pow(max(elevation, 0.0), 0.45);
					vec3 skyGradient = mix(zenithColor, horizonColor, horizonBlend);

					// Ground gradient below horizon
					float groundBlend = pow(max(-elevation, 0.0), 0.6);
					vec3 finalColor = mix(skyGradient, groundColor, groundBlend);

					// Sun glow effect
					float sunDot = max(dot(rayDir, sunDirection), 0.0);
					float sunGlow = pow(sunDot, sunGlowExponent) * sunGlowIntensity;

					// Add sun atmospheric glow (more spread out)
					float atmosphericGlow = pow(sunDot, 2.5) * 0.25;

					// Horizon haze - more glow near horizon
					float horizonHaze = (1.0 - abs(elevation)) * pow(sunDot, 3.0) * 0.3;

					finalColor += sunGlowColor * (sunGlow + atmosphericGlow + horizonHaze);

					// Slight exposure adjustment
					finalColor = 1.0 - exp(-finalColor * 1.2);

					gl_FragColor = vec4(finalColor, 1.0);
				}
			`,
		})
	}

	private createSkyMesh(): THREE.Mesh {
		// Fullscreen quad
		const geometry = new THREE.PlaneGeometry(2, 2, 1, 1)
		const mesh = new THREE.Mesh(geometry, this.skyMaterial)
		mesh.frustumCulled = false
		mesh.renderOrder = -1000
		return mesh
	}

	private updateSkyUniforms(viewMatrix: mat4) {
		const uniforms = this.skyMaterial.uniforms

		// Update sun direction
		const dir = uniforms.sunDirection?.value as THREE.Vector3 | undefined
		if (dir) {
			dir.set(
				this.sunlight.direction[0],
				this.sunlight.direction[1],
				this.sunlight.direction[2]
			).normalize()
		}

		// Update inverse matrices for ray reconstruction
		const invView = uniforms.invViewMatrix?.value as THREE.Matrix4 | undefined
		const invProj = uniforms.invProjectionMatrix?.value as THREE.Matrix4 | undefined

		if (invView) {
			// Convert mat4 to THREE.Matrix4
			const threeViewMat = new THREE.Matrix4()
			threeViewMat.fromArray(viewMatrix as number[])
			invView.copy(threeViewMat).invert()
		}

		if (invProj) {
			invProj.copy(this.camera.projectionMatrix).invert()
		}
	}

	private createShadowDepthMaterial(): THREE.RawShaderMaterial {
		return new THREE.RawShaderMaterial({
			name: 'deepslate-shadow-depth',
			vertexShader: `
				precision highp float;
				uniform mat4 projectionMatrix;
				uniform mat4 modelViewMatrix;
				attribute vec3 position;

				void main(void) {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;

				void main(void) {
					gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
				}
			`,
			side: THREE.FrontSide,
			depthTest: true,
			depthWrite: true,
		})
	}

	private initShadowMap() {
		if (!this.sunlight.shadow.enabled) return

		const size = this.sunlight.shadow.mapSize
		this.shadowMap = new THREE.WebGLRenderTarget(size, size, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
		})
	}

	private updateShadowCamera() {
		const frustumSize = this.sunlight.shadow.frustumSize
		const halfSize = frustumSize / 2

		// Position shadow camera at center of structure, looking along sun direction
		const dir = new THREE.Vector3(
			this.sunlight.direction[0],
			this.sunlight.direction[1],
			this.sunlight.direction[2]
		).normalize()

		const center = new THREE.Vector3(
			this.targetCenter[0],
			this.targetCenter[1],
			this.targetCenter[2]
		)

		// Position camera along light direction, far enough to encompass structure
		const lightPos = center.clone().add(dir.clone().multiplyScalar(frustumSize))

		this.shadowCamera.left = -halfSize
		this.shadowCamera.right = halfSize
		this.shadowCamera.top = halfSize
		this.shadowCamera.bottom = -halfSize
		this.shadowCamera.near = 0.1
		this.shadowCamera.far = frustumSize * 2
		this.shadowCamera.position.copy(lightPos)
		this.shadowCamera.lookAt(center)
		this.shadowCamera.updateMatrixWorld(true)
		this.shadowCamera.updateProjectionMatrix()
	}

	private renderShadowPass() {
		if (!this.sunlight.shadow.enabled || !this.shadowMap) return

		this.updateShadowCamera()

		// Calculate shadow matrix: bias * projection * view
		const shadowMatrix = new THREE.Matrix4()
		shadowMatrix.multiplyMatrices(
			this.shadowCamera.projectionMatrix,
			this.shadowCamera.matrixWorldInverse
		)

		// Update shadow uniforms for both materials
		const updateMaterial = (material: THREE.RawShaderMaterial) => {
			const uniforms = material.uniforms
			if (uniforms.shadowMatrix) {
				uniforms.shadowMatrix.value.copy(shadowMatrix)
			}
			if (uniforms.shadowMap) {
				uniforms.shadowMap.value = this.shadowMap?.texture ?? null
			}
		}
		updateMaterial(this.opaqueMaterial)
		updateMaterial(this.transparentMaterial)

		// Render shadow map
		const oldRenderTarget = this.renderer.getRenderTarget()

		this.renderer.setRenderTarget(this.shadowMap)
		this.renderer.setClearColor(0xffffff, 1)
		this.renderer.clear()

		// Render structure with depth material
		this.structureScene.overrideMaterial = this.shadowDepthMaterial
		this.renderer.render(this.structureScene, this.shadowCamera)
		this.structureScene.overrideMaterial = null

		// Restore render target
		this.renderer.setRenderTarget(oldRenderTarget)
		this.renderer.setClearColor(0x000000, 1)
	}

	// ==================== POST-PROCESSING ====================

	private initPostProcessing(width: number, height: number) {
		if (!this.sunlight.postProcess.enabled) return

		// Create render targets
		const createTarget = (w: number, h: number, depthBuffer = false) => {
			return new THREE.WebGLRenderTarget(w, h, {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat,
				type: THREE.HalfFloatType,
				depthBuffer,
			})
		}

		this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			type: THREE.HalfFloatType,
			depthBuffer: true,
		})
		// Attach depth texture for SSAO
		this.sceneTarget.depthTexture = new THREE.DepthTexture(width, height)
		this.sceneTarget.depthTexture.format = THREE.DepthFormat
		this.sceneTarget.depthTexture.type = THREE.UnsignedIntType

		this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			depthBuffer: true,
		})
		this.aoTarget = createTarget(width, height)
		this.bloomBrightTarget = createTarget(width / 2, height / 2)
		this.bloomBlurTarget1 = createTarget(width / 2, height / 2)
		this.bloomBlurTarget2 = createTarget(width / 2, height / 2)
		this.godRaysTarget = createTarget(width / 2, height / 2)

		// Create fullscreen quad for post-processing
		const quadGeom = new THREE.PlaneGeometry(2, 2)
		this.postProcessQuad = new THREE.Mesh(quadGeom)
		this.postProcessQuad.frustumCulled = false

		// Create materials
		this.ssaoMaterial = this.createSSAOMaterial()
		this.bloomBrightMaterial = this.createBloomBrightMaterial()
		this.bloomBlurMaterial = this.createBloomBlurMaterial()
		this.godRaysMaterial = this.createGodRaysMaterial()
		this.compositeMaterial = this.createCompositeMaterial()
	}

	private resizePostProcessTargets(width: number, height: number) {
		if (!this.sunlight.postProcess.enabled) return
		if (width <= 0 || height <= 0) return

		this.sceneTarget?.setSize(width, height)
		// Recreate depth texture at new size
		if (this.sceneTarget) {
			this.sceneTarget.depthTexture?.dispose()
			this.sceneTarget.depthTexture = new THREE.DepthTexture(width, height)
			this.sceneTarget.depthTexture.format = THREE.DepthFormat
			this.sceneTarget.depthTexture.type = THREE.UnsignedIntType
		}
		this.depthTarget?.setSize(width, height)
		this.aoTarget?.setSize(width, height)
		this.bloomBrightTarget?.setSize(Math.max(1, width / 2), Math.max(1, height / 2))
		this.bloomBlurTarget1?.setSize(Math.max(1, width / 2), Math.max(1, height / 2))
		this.bloomBlurTarget2?.setSize(Math.max(1, width / 2), Math.max(1, height / 2))
		this.godRaysTarget?.setSize(Math.max(1, width / 2), Math.max(1, height / 2))
	}

	private createSSAOMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				tDepth: { value: null },
				resolution: { value: new THREE.Vector2() },
				cameraNear: { value: this.camera.near },
				cameraFar: { value: this.camera.far },
				aoRadius: { value: this.sunlight.postProcess.ao.radius },
				aoIntensity: { value: this.sunlight.postProcess.ao.intensity },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform sampler2D tDepth;
				uniform vec2 resolution;
				uniform float cameraNear;
				uniform float cameraFar;
				uniform float aoRadius;
				uniform float aoIntensity;
				varying vec2 vUv;

				float getDepth(vec2 uv) {
					return texture2D(tDepth, uv).r;
				}

				float getLinearDepth(vec2 uv) {
					float depth = getDepth(uv);
					return cameraNear * cameraFar / (cameraFar - depth * (cameraFar - cameraNear));
				}

				void main() {
					vec4 color = texture2D(tDiffuse, vUv);
					float depth = getLinearDepth(vUv);

					// Simple SSAO - sample in a small radius
					float ao = 0.0;
					float radius = aoRadius / depth;
					vec2 texelSize = 1.0 / resolution;

					const int SAMPLES = 8;
					float angleStep = 6.28318 / float(SAMPLES);

					for (int i = 0; i < SAMPLES; i++) {
						float angle = float(i) * angleStep;
						vec2 offset = vec2(cos(angle), sin(angle)) * radius * texelSize * 20.0;
						float sampleDepth = getLinearDepth(vUv + offset);
						float diff = depth - sampleDepth;
						ao += smoothstep(0.0, 0.3, diff) * smoothstep(1.0, 0.0, diff);
					}
					ao = 1.0 - (ao / float(SAMPLES)) * aoIntensity;

					gl_FragColor = vec4(color.rgb * ao, color.a);
				}
			`,
		})
	}

	private createBloomBrightMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				threshold: { value: this.sunlight.postProcess.bloom.threshold },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform float threshold;
				varying vec2 vUv;

				void main() {
					vec4 color = texture2D(tDiffuse, vUv);
					float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
					float contribution = smoothstep(threshold, threshold + 0.3, brightness);
					gl_FragColor = vec4(color.rgb * contribution, 1.0);
				}
			`,
		})
	}

	private createBloomBlurMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				direction: { value: new THREE.Vector2(1, 0) },
				resolution: { value: new THREE.Vector2() },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform vec2 direction;
				uniform vec2 resolution;
				varying vec2 vUv;

				void main() {
					vec2 texelSize = 1.0 / resolution;
					vec4 result = vec4(0.0);

					// 9-tap Gaussian blur
					float weights[5];
					weights[0] = 0.227027;
					weights[1] = 0.1945946;
					weights[2] = 0.1216216;
					weights[3] = 0.054054;
					weights[4] = 0.016216;

					result += texture2D(tDiffuse, vUv) * weights[0];
					for (int i = 1; i < 5; i++) {
						vec2 offset = direction * texelSize * float(i) * 2.0;
						result += texture2D(tDiffuse, vUv + offset) * weights[i];
						result += texture2D(tDiffuse, vUv - offset) * weights[i];
					}

					gl_FragColor = result;
				}
			`,
		})
	}

	private createGodRaysMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				tScene: { value: null },
				sunPosition: { value: new THREE.Vector2(0.5, 0.5) },
				intensity: { value: this.sunlight.postProcess.godRays.intensity },
				decay: { value: this.sunlight.postProcess.godRays.decay },
				density: { value: this.sunlight.postProcess.godRays.density },
				numSamples: { value: this.sunlight.postProcess.godRays.samples },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform sampler2D tScene;
				uniform vec2 sunPosition;
				uniform float intensity;
				uniform float decay;
				uniform float density;
				uniform int numSamples;
				varying vec2 vUv;

				void main() {
					vec2 deltaUv = (vUv - sunPosition) * density / float(numSamples);
					vec2 uv = vUv;
					vec4 color = texture2D(tDiffuse, uv);
					float illuminationDecay = 1.0;

					for (int i = 0; i < 100; i++) {
						if (i >= numSamples) break;
						uv -= deltaUv;
						vec4 sampleColor = texture2D(tDiffuse, uv);
						sampleColor *= illuminationDecay;
						color += sampleColor;
						illuminationDecay *= decay;
					}

					color *= intensity / float(numSamples);

					// Add to original scene
					vec4 sceneColor = texture2D(tScene, vUv);
					gl_FragColor = sceneColor + color;
				}
			`,
		})
	}

	private createCompositeMaterial(): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				tScene: { value: null },
				tBloom: { value: null },
				bloomIntensity: { value: this.sunlight.postProcess.bloom.intensity },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tScene;
				uniform sampler2D tBloom;
				uniform float bloomIntensity;
				varying vec2 vUv;

				void main() {
					vec4 sceneColor = texture2D(tScene, vUv);
					vec4 bloomColor = texture2D(tBloom, vUv);

					// Add bloom
					vec3 color = sceneColor.rgb + bloomColor.rgb * bloomIntensity;

					// Tone mapping (ACES approximation)
					color = color * (2.51 * color + 0.03) / (color * (2.43 * color + 0.59) + 0.14);

					// Gamma correction
					color = pow(color, vec3(1.0 / 2.2));

					gl_FragColor = vec4(color, sceneColor.a);
				}
			`,
		})
	}

	private getSunScreenPosition(viewMatrix: mat4): THREE.Vector2 {
		// Get sun direction in world space
		const sunDir = new THREE.Vector3(
			this.sunlight.direction[0],
			this.sunlight.direction[1],
			this.sunlight.direction[2]
		).normalize()

		// Position sun far away in that direction from camera
		const camPos = this.getCameraPosition(viewMatrix) ?? vec3.fromValues(0, 0, 10)
		const sunWorldPos = new THREE.Vector3(camPos[0], camPos[1], camPos[2])
			.add(sunDir.multiplyScalar(100))

		// Project to screen space
		sunWorldPos.project(this.camera)

		return new THREE.Vector2(
			(sunWorldPos.x + 1) * 0.5,
			(sunWorldPos.y + 1) * 0.5
		)
	}

	private renderPostProcessing(viewMatrix: mat4) {
		if (!this.sunlight.postProcess.enabled || !this.sceneTarget || !this.postProcessQuad) {
			return false
		}

		const pp = this.sunlight.postProcess
		const width = this.sceneTarget.width
		const height = this.sceneTarget.height

		// 1. Render scene to offscreen target
		this.renderer.setRenderTarget(this.sceneTarget)
		this.renderer.clear()
		this.renderer.render(this.skyScene, this.skyCamera)
		this.renderer.render(this.structureScene, this.camera)
		this.setOverlayVisibility({ grid: false, invisible: false, outline: false, sunDisc: true })
		this.renderer.render(this.overlayScene, this.camera)

		let currentScene = this.sceneTarget.texture

		// 2. SSAO pass
		if (pp.ao.enabled && this.ssaoMaterial && this.aoTarget) {
			this.ssaoMaterial.uniforms.tDiffuse.value = currentScene
			this.ssaoMaterial.uniforms.tDepth.value = this.sceneTarget.depthTexture
			this.ssaoMaterial.uniforms.resolution.value.set(width, height)
			this.ssaoMaterial.uniforms.cameraNear.value = this.camera.near
			this.ssaoMaterial.uniforms.cameraFar.value = this.camera.far

			this.postProcessQuad.material = this.ssaoMaterial
			this.renderer.setRenderTarget(this.aoTarget)
			this.renderer.render(this.postProcessQuad, this.skyCamera)
			currentScene = this.aoTarget.texture
		}

		// 3. Bloom bright pass
		if (pp.bloom.enabled && this.bloomBrightMaterial && this.bloomBrightTarget && this.bloomBlurTarget1 && this.bloomBlurTarget2 && this.bloomBlurMaterial) {
			// Extract bright pixels
			this.bloomBrightMaterial.uniforms.tDiffuse.value = currentScene
			this.postProcessQuad.material = this.bloomBrightMaterial
			this.renderer.setRenderTarget(this.bloomBrightTarget)
			this.renderer.render(this.postProcessQuad, this.skyCamera)

			// Horizontal blur
			this.bloomBlurMaterial.uniforms.tDiffuse.value = this.bloomBrightTarget.texture
			this.bloomBlurMaterial.uniforms.direction.value.set(1, 0)
			this.bloomBlurMaterial.uniforms.resolution.value.set(width / 2, height / 2)
			this.postProcessQuad.material = this.bloomBlurMaterial
			this.renderer.setRenderTarget(this.bloomBlurTarget1)
			this.renderer.render(this.postProcessQuad, this.skyCamera)

			// Vertical blur
			this.bloomBlurMaterial.uniforms.tDiffuse.value = this.bloomBlurTarget1.texture
			this.bloomBlurMaterial.uniforms.direction.value.set(0, 1)
			this.renderer.setRenderTarget(this.bloomBlurTarget2)
			this.renderer.render(this.postProcessQuad, this.skyCamera)
		}

		// 4. God rays pass
		if (pp.godRays.enabled && this.godRaysMaterial && this.godRaysTarget && this.bloomBrightTarget) {
			const sunPos = this.getSunScreenPosition(viewMatrix)
			this.godRaysMaterial.uniforms.tDiffuse.value = this.bloomBrightTarget.texture
			this.godRaysMaterial.uniforms.tScene.value = currentScene
			this.godRaysMaterial.uniforms.sunPosition.value.copy(sunPos)

			this.postProcessQuad.material = this.godRaysMaterial
			this.renderer.setRenderTarget(this.godRaysTarget)
			this.renderer.render(this.postProcessQuad, this.skyCamera)
			currentScene = this.godRaysTarget.texture
		}

		// 5. Final composite
		if (this.compositeMaterial) {
			this.compositeMaterial.uniforms.tScene.value = currentScene
			this.compositeMaterial.uniforms.tBloom.value = this.bloomBlurTarget2?.texture ?? null

			this.postProcessQuad.material = this.compositeMaterial
			this.renderer.setRenderTarget(null)
			this.renderer.render(this.postProcessQuad, this.skyCamera)
		}

		return true
	}
}
