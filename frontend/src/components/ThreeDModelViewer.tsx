import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

type ThreeDModelViewerProps = {
  modelContent: string
  modelFormat: 'obj' | 'stl'
  modelName: string
}

export function ThreeDModelViewer({
  modelContent,
  modelFormat,
  modelName,
}: ThreeDModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let animationFrameId = 0
    let disposed = false

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f8fbff')

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const controls = new TrackballControls(camera, renderer.domElement)
    controls.rotateSpeed = 4
    controls.zoomSpeed = 1.2
    controls.panSpeed = 0.8
    controls.staticMoving = false
    controls.dynamicDampingFactor = 0.12

    scene.add(new THREE.HemisphereLight('#ffffff', '#71849a', 2.5))

    const keyLight = new THREE.DirectionalLight('#ffffff', 3)
    keyLight.position.set(1, 2, 3)
    keyLight.castShadow = true
    scene.add(keyLight)

    const resizeRenderer = () => {
      const { clientWidth, clientHeight } = container
      const width = Math.max(clientWidth, 1)
      const height = Math.max(clientHeight, 1)

      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(container)
    resizeRenderer()

    const material = new THREE.MeshStandardMaterial({
      color: '#7b9db8',
      metalness: 0.2,
      roughness: 0.56,
    })

    let model: THREE.Object3D | null = null

    const showLoadError = () => {
      if (disposed) {
        return
      }

      const errorMessage = document.createElement('p')
      errorMessage.className = 'quotation-three-d-viewer-error'
      errorMessage.textContent = '3D 모델을 불러올 수 없습니다.'
      container.appendChild(errorMessage)
    }

    const displayModel = (loadedModel: THREE.Object3D) => {
      if (disposed) {
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
          }
        })
        return
      }

      model = loadedModel

      loadedModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      const bounds = new THREE.Box3().setFromObject(loadedModel)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const largestDimension = Math.max(size.x, size.y, size.z, 1)

      loadedModel.position.sub(center)
      scene.add(loadedModel)

      camera.near = Math.max(largestDimension / 1000, 0.01)
      camera.far = largestDimension * 100
      camera.position.set(
        largestDimension * 1.45,
        largestDimension * 1.05,
        largestDimension * 1.45,
      )
      camera.updateProjectionMatrix()
      controls.target.set(0, 0, 0)
      controls.update()
    }

    if (modelFormat === 'obj') {
      try {
        displayModel(new OBJLoader().parse(modelContent))
      } catch {
        showLoadError()
      }
    } else {
      new STLLoader().load(
        modelContent,
        (geometry) => {
          geometry.computeVertexNormals()
          displayModel(new THREE.Mesh(geometry, material))
        },
        undefined,
        showLoadError,
      )
    }

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      controls.dispose()
      model?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
        }
      })
      material.dispose()
      renderer.dispose()
      container.replaceChildren()
    }
  }, [modelContent, modelFormat])

  return (
    <div
      ref={containerRef}
      className="quotation-three-d-viewer"
      aria-label={`${modelName} 3D 뷰어`}
    />
  )
}
