#!/usr/bin/env python3
"""Mira original-human source .blend QA (Blender 4.x).

Run: blender --background path/to/authoring.blend --python scripts/blender/mira_human_preflight.py -- --output /tmp/mira-human-qa.json
Never fetch a third-party model or auto-approve rights.
"""
import json
import re
import sys
from pathlib import Path

try:
    import bpy
except ImportError as exc:
    raise SystemExit("Run through Blender's Python runtime (bpy required)") from exc


def normalize(name):
    return re.sub(r"[^a-z0-9]", "", str(name).lower()).replace("mixamorig", "")


REQUIRED_BONES = {
    "head": ("head", "neck"),
    "spine": ("spine", "chest"),
    "left_upper_arm": ("leftupperarm", "leftarm"),
    "right_upper_arm": ("rightupperarm", "rightarm"),
    "left_lower_arm": ("leftforearm", "leftlowerarm"),
    "right_lower_arm": ("rightforearm", "rightlowerarm"),
    "left_upper_leg": ("leftupleg", "leftupperleg", "leftthigh"),
    "right_upper_leg": ("rightupleg", "rightupperleg", "rightthigh"),
    "left_lower_leg": ("leftleg", "leftlowerleg", "leftshin"),
    "right_lower_leg": ("rightleg", "rightlowerleg", "rightshin"),
}


def role(material):
    explicit = str(material.get("miraRegion", "")).strip().lower()
    if explicit in {"skin", "eyes", "hair", "outfit"}:
        return explicit
    name = normalize(material.name)
    if re.search(r"iris|sclera|cornea|eyeball|pupil", name):
        return "eyes"
    if re.search(r"hair|strand|scalp|braid|fringe", name):
        return "hair"
    if re.search(r"face|skin|epiderm|body", name):
        return "skin"
    if re.search(r"cloth|dress|shirt|outfit|garment|fabric", name):
        return "outfit"
    return None


def material_data(material):
    nodes = list(material.node_tree.nodes) if material.use_nodes and material.node_tree else []
    images = [n.image for n in nodes if n.type == "TEX_IMAGE" and n.image]
    normal = any(n.type == "NORMAL_MAP" for n in nodes)
    principled = any(n.type == "BSDF_PRINCIPLED" for n in nodes)
    missing = [
        im.name for im in images if im.source == "FILE" and
        not im.packed_file and im.filepath and
        not Path(bpy.path.abspath(im.filepath)).exists()
    ]
    return {
        "name": material.name,
        "region": role(material),
        "principledPBR": principled,
        "imageTextures": len(images),
        "normalMap": normal,
        "missingFiles": missing,
    }


def audit():
    errors, warnings = [], []
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    vertices = sum(len(o.data.vertices) for o in meshes)
    triangles = sum(sum(max(1, len(p.vertices) - 2) for p in o.data.polygons) for o in meshes)
    if not rigs:
        errors.append("missing_armature")
    joint_names = [normalize(b.name) for rig in rigs for b in rig.data.bones]
    for part, aliases in REQUIRED_BONES.items():
        if not any(any(alias in n for alias in aliases) for n in joint_names):
            errors.append("rig_" + part + "_missing")
    if not any(any(mod.type == "ARMATURE" for mod in o.modifiers) for o in meshes):
        errors.append("skin_binding_missing")
    if vertices < 30000:
        errors.append("mesh_detail_below_30k_vertices")
    if triangles > 1250000:
        errors.append("mesh_exceeds_triangle_budget")
    if triangles > 250000:
        warnings.append("mobile_lod_recommended")
    mats = list({m.name: m for o in meshes for m in o.data.materials if m}.values())
    materials = [material_data(m) for m in mats]
    for region in ("skin", "eyes", "hair"):
        if not any(m["region"] == region and m["principledPBR"] and m["imageTextures"] for m in materials):
            errors.append("textured_pbr_" + region + "_missing")
    if not any(m["region"] == "skin" and m["normalMap"] for m in materials):
        errors.append("skin_normal_map_missing")
    if any(m["missingFiles"] for m in materials):
        errors.append("external_texture_files_missing")
    shapes = {normalize(key.name) for obj in meshes if obj.data.shape_keys
              for key in obj.data.shape_keys.key_blocks}
    if not any("blink" in n or "eyeclose" in n for n in shapes):
        errors.append("face_blink_shape_missing")
    if not any("jawopen" in n or "mouthopen" in n or n in {"aa", "moutha"} for n in shapes):
        errors.append("face_speech_shape_missing")
    if not any("smile" in n or "happy" in n for n in shapes):
        errors.append("face_smile_shape_missing")
    if not bpy.data.filepath:
        warnings.append("save_blend_source_before_export")
    return {
        "schemaVersion": 1,
        "result": "technical_candidate" if not errors else "rejected",
        "approvedForProduction": False,
        "copyrightClearance": False,
        "blend": bpy.data.filepath,
        "stats": {"meshCount": len(meshes), "rigCount": len(rigs),
                  "vertices": vertices, "triangles": triangles},
        "shapes": sorted(shapes),
        "materials": materials,
        "errors": sorted(set(errors)),
        "warnings": sorted(set(warnings)),
    }


def main():
    output = None
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for idx, arg in enumerate(args):
        if arg == "--output" and idx + 1 < len(args):
            output = Path(args[idx + 1])
    result = audit()
    message = json.dumps(result, indent=2, ensure_ascii=False)
    print("[MIRA 3D SOURCE PREFLIGHT] " + message)
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(message + "\n", encoding="utf-8")
    if result["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
