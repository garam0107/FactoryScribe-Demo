import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

type ThreeDModelViewerProps = {
  modelText: string
  modelName: string
}

export function ThreeDModelViewer({
  modelText,
  modelName,
}: ThreeDModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let animationFrameId = 0

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f8fbff')

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = false

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

    try {
      const model = new OBJLoader().parse(modelText)

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const largestDimension = Math.max(size.x, size.y, size.z, 1)

      model.position.sub(center)
      scene.add(model)

      const grid = new THREE.GridHelper(
        largestDimension * 2,
        20,
        '#9eb0bf',
        '#d8e1e8',
      )
      grid.position.y = -size.y / 2
      scene.add(grid)

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
    } catch {
      const errorMessage = document.createElement('p')
      errorMessage.className = 'quotation-three-d-viewer-error'
      errorMessage.textContent = '3D 모델을 불러올 수 없습니다.'
      container.appendChild(errorMessage)
    }

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      controls.dispose()
      material.dispose()
      renderer.dispose()
      container.replaceChildren()
    }
  }, [modelText])

  return (
    <div
      ref={containerRef}
      className="quotation-three-d-viewer"
      aria-label={`${modelName} 3D 뷰어`}
    />
  )
}
