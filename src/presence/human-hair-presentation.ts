import * as THREE from 'three';

/**
 * Reversible hairstyle treatment for the licensed Vitruvian lab mesh only.
 * Soft-clip long hair-card ends around shoulder height; do not alter the
 * original GLB topology, scalp, bone transforms or any production avatar.
 * Hair alpha-to-coverage remains enabled for MSAA.
 */
export const HUMAN_HAIR_PRESENTATION={
  fadeStartY:1.09,
  fadeEndY:1.25,
  revision:'human-hair-shoulder-cut-v1',
} as const;

export function applyHumanHairPresentation(material:THREE.MeshStandardMaterial):void{
  material.onBeforeCompile=(shader)=>{
    const vertexNeedle='#include <project_vertex>';
    const fragmentNeedle='#include <alphatest_fragment>';
    if(!shader.vertexShader.includes(vertexNeedle)||
       !shader.fragmentShader.includes(fragmentNeedle))return;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying float miraHairWorldY;');
    shader.vertexShader=shader.vertexShader.replace(vertexNeedle,
      vertexNeedle+'\nmiraHairWorldY=(modelMatrix*vec4(transformed,1.0)).y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying float miraHairWorldY;');
    shader.fragmentShader=shader.fragmentShader.replace(fragmentNeedle,
      'diffuseColor.a *= smoothstep('+
       HUMAN_HAIR_PRESENTATION.fadeStartY.toFixed(3)+','+
       HUMAN_HAIR_PRESENTATION.fadeEndY.toFixed(3)+
       ',miraHairWorldY);\n'+fragmentNeedle);
  };
  material.customProgramCacheKey=()=>HUMAN_HAIR_PRESENTATION.revision;
  material.needsUpdate=true;
}
