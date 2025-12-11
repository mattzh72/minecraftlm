import { mat4, vec3 } from 'gl-matrix'
import * as THREE from 'three'
import type { StructureProvider } from '../core/index.js'
import { BlockState } from '../core/index.js'
import type { Color } from '../index.js'
import { ChunkBuilder } from './ChunkBuilder.js'
import { Mesh } from './Mesh.js'
import type { Resources } from './StructureRenderer.js'

type ThreeStructureRendererOptions = {
	chunkSize?: number,
	useInvisibleBlockBuffer?: boolean,
	drawDistance?: number,
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
	private readonly overlayScene: THREE.Scene
	private readonly camera: THREE.PerspectiveCamera
	private readonly atlasTexture: THREE.DataTexture
	private readonly opaqueMaterial: THREE.RawShaderMaterial
	private readonly transparentMaterial: THREE.RawShaderMaterial
	private readonly coloredMaterial: THREE.RawShaderMaterial
	private readonly lineMaterial: THREE.LineBasicMaterial

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
			alpha: true,
			antialias: true,
			preserveDrawingBuffer: true,
		})
		this.renderer.autoClear = false
		this.renderer.setClearColor(0x000000, 0)

		this.structureScene = new THREE.Scene()
		this.overlayScene = new THREE.Scene()

		this.camera = new THREE.PerspectiveCamera(70, (canvas.clientWidth || 1) / (canvas.clientHeight || 1), 0.1, 500)

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

		this.atlasTexture = this.createAtlasTexture(this.resources.getTextureAtlas())
		this.pixelSize = this.resources.getPixelSize?.() ?? 0

		this.opaqueMaterial = this.createStructureMaterial(false)
		this.transparentMaterial = this.createStructureMaterial(true)
		this.coloredMaterial = this.createColoredMaterial()
		this.lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: true })

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
	}

	public setViewport(x: number, y: number, width: number, height: number) {
		this.renderer.setViewport(x, y, width, height)
		this.renderer.setSize(width, height, false)
		this.camera.aspect = width / Math.max(height, 1)
		this.camera.updateProjectionMatrix()
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
		this.renderer.clear()
		this.structureScene.overrideMaterial = null
		this.renderer.render(this.structureScene, this.camera)
	}

	public drawColoredStructure(viewMatrix: mat4) {
		this.prepareCamera(viewMatrix)
		this.renderer.clear()
		this.structureScene.overrideMaterial = this.coloredMaterial
		this.renderer.render(this.structureScene, this.camera)
		this.structureScene.overrideMaterial = null
	}

	public drawGrid(viewMatrix: mat4) {
		if (!this.grid) return
		this.prepareCamera(viewMatrix)
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
		this.grid?.geometry.dispose()
		this.invisibleBlocks?.geometry.dispose()
		this.outline?.geometry.dispose()
		this.renderer.dispose()
	}

	private prepareCamera(viewMatrix: mat4) {
		const camPos = this.getCameraPosition(viewMatrix) ?? vec3.fromValues(0, 0, 10)
		this.camera.position.set(camPos[0], camPos[1], camPos[2])
		this.camera.up.set(0, 1, 0)
		this.camera.lookAt(this.targetCenter[0], this.targetCenter[1], this.targetCenter[2])
		this.camera.updateMatrixWorld(true)

		this.chunkMeshes.forEach(mesh => mesh.visible = true)
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
	}

	private createStructureMaterial(transparent: boolean) {
		return new THREE.RawShaderMaterial({
			name: transparent ? 'deepslate-structure-transparent' : 'deepslate-structure-opaque',
			vertexShader: `
				precision highp float;
				uniform mat4 projectionMatrix;
				uniform mat4 modelViewMatrix;
				attribute vec3 position;
				attribute vec2 uv;
				attribute vec4 texLimit;
				attribute vec3 color;
				attribute vec3 normal;
			
				uniform float pixelSize;
			
				varying highp vec2 vTexCoord;
				varying highp vec4 vTexLimit;
				varying highp vec3 vTintColor;
				varying highp float vLighting;
			
				void main(void) {
					vTexCoord = uv;
					vTexLimit = texLimit;
					vTintColor = color;
					vLighting = normal.y * 0.2 + abs(normal.z) * 0.1 + 0.8;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;
				varying highp vec2 vTexCoord;
				varying highp vec4 vTexLimit;
				varying highp vec3 vTintColor;
				varying highp float vLighting;
			
				uniform sampler2D atlas;
				uniform highp float pixelSize;
			
				void main(void) {
					vec4 texColor = texture2D(atlas, clamp(vTexCoord,
						vTexLimit.xy + vec2(0.5, 0.5) * pixelSize,
						vTexLimit.zw - vec2(0.5, 0.5) * pixelSize
					));
					if(texColor.a < 0.01) discard;
					gl_FragColor = vec4(texColor.xyz * vTintColor * vLighting, texColor.a);
				}
			`,
			uniforms: {
				atlas: { value: this.atlasTexture },
				pixelSize: { value: this.pixelSize },
			},
			transparent,
			depthWrite: !transparent,
			depthTest: true,
			alphaTest: 0.01,
			side: THREE.FrontSide,
		})
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

	private setOverlayVisibility(flags: { grid: boolean, invisible: boolean, outline: boolean }) {
		if (this.grid) this.grid.visible = flags.grid
		if (this.invisibleBlocks) this.invisibleBlocks.visible = flags.invisible
		if (this.outline) this.outline.visible = flags.outline
	}

	private createAtlasTexture(image: ImageData) {
		const texture = new THREE.DataTexture(image.data, image.width, image.height, THREE.RGBAFormat)
		texture.magFilter = THREE.NearestFilter
		texture.minFilter = THREE.NearestMipmapLinearFilter
		texture.flipY = false
		texture.generateMipmaps = true
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
}
