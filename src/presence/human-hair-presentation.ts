import * as THREE from 'three';

/**
 * Reversible hairstyle treatment for the licensed Vitruvian lab mesh only.
 * Soft-clip long hair-card ends around shoulder height; do not alter the
 * original GLB topology, scalp, bone transforms or any production avatar.
 * Hair alpha-to-coverage remains enabled for MSAA.
 */
export const HUMAN_HAIR_PRESENTATION={
  fadeStartY:1.09,
  fadeEndY:1.28,
  revision:'human-hair-layered-v2',
} as const;

export function applyHumanHairPresentation(material:THREE.MeshStandardMaterial):void{
  material.onBeforeCompile=(shader)=>{
    const vertexNeedle='#include <project_vertex>';
    const fragmentNeedle='#include <alphatest_fragment>';
    if(!shader.vertexShader.includes(vertexNeedle)||
       !shader.fragmentShader.includes(fragmentNeedle))return;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 miraHairWorldPosition;');
    shader.vertexShader=shader.vertexShader.replace(vertexNeedle,
      vertexNeedle+'\nmiraHairWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 miraHairWorldPosition;');
    shader.fragmentShader=shader.fragmentShader.replace(fragmentNeedle,
      'float miraHairLayer = 0.028*sin(13.0*miraHairWorldPosition.x + 21.0*miraHairWorldPosition.z)' +
      ' + 0.018*sin(27.0*miraHairWorldPosition.z - 11.0*miraHairWorldPosition.x);\n' +
      'float miraHairStart = '+HUMAN_HAIR_PRESENTATION.fadeStartY.toFixed(3)+
      ' - 0.035*min(abs(miraHairWorldPosition.x),0.5) + miraHairLayer;\n' +
      'diffuseColor.a *= smoothstep(miraHairStart,miraHairStart + '+
       (HUMAN_HAIR_PRESENTATION.fadeEndY-HUMAN_HAIR_PRESENTATION.fadeStartY).toFixed(3)+
       ',miraHairWorldPosition.y);\n'+fragmentNeedle);
  };
  material.customProgramCacheKey=()=>HUMAN_HAIR_PRESENTATION.revision;
  material.needsUpdate=true;
}
