#!/usr/bin/env python3
"""Export a recorded Newton episode as a self-contained animated glTF (GLB)."""

import argparse
import gzip
import io
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image


class Glb:
    def __init__(self):
        self.data = bytearray()
        self.doc = {
            "asset": {"version": "2.0", "generator": "ImPress demo exporter"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            # Rotate the recorded Z-up world into glTF's Y-up scene.
            "nodes": [{"rotation": [-2**-0.5, 0, 0, 2**-0.5], "children": []}],
            "meshes": [],
            "materials": [],
            "accessors": [],
            "bufferViews": [],
        }

    def add(self, key, value):
        items = self.doc.setdefault(key, [])
        items.append(value)
        return len(items) - 1

    def view(self, payload, target=None):
        self.data.extend(b"\0" * (-len(self.data) % 4))
        view = {"buffer": 0, "byteOffset": len(self.data), "byteLength": len(payload)}
        if target is not None:
            view["target"] = target
        self.data.extend(payload)
        return self.add("bufferViews", view)

    def accessor(self, values, kind, dtype="<f4", target=None, bounds=False):
        values = np.asarray(values, dtype=dtype)
        entry = {
            "bufferView": self.view(values.tobytes(), target),
            "componentType": {"<f4": 5126, "<u2": 5123, "<u4": 5125}[dtype],
            "count": len(values),
            "type": kind,
        }
        if bounds:
            entry.update(min=np.atleast_1d(values.min(axis=0)).tolist(),
                         max=np.atleast_1d(values.max(axis=0)).tolist())
        return self.add("accessors", entry)

    def write(self, output):
        self.data.extend(b"\0" * (-len(self.data) % 4))
        self.doc["buffers"] = [{"byteLength": len(self.data)}]
        metadata = json.dumps(self.doc, separators=(",", ":")).encode()
        metadata += b" " * (-len(metadata) % 4)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("wb") as file:
            file.write(struct.pack("<4sII", b"glTF", 2, 28 + len(metadata) + len(self.data)))
            file.write(struct.pack("<I4s", len(metadata), b"JSON"))
            file.write(metadata)
            file.write(struct.pack("<I4s", len(self.data), b"BIN\0"))
            file.write(self.data)


def read_obj(path):
    vertices, faces = [], []
    for line in path.read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            vertices.append([float(value) for value in fields[1:4]])
        elif fields[0] == "f":
            face = [int(value.split("/")[0]) for value in fields[1:]]
            face = [index - 1 if index > 0 else len(vertices) + index for index in face]
            faces.extend((face[0], face[i], face[i + 1]) for i in range(1, len(face) - 1))
    return np.asarray(vertices), np.asarray(faces)


def vertex_normals(vertices, faces):
    # Weld coincident vertices for smoothing across texture seams.
    positions, weld = np.unique(vertices, axis=0, return_inverse=True)
    triangles = vertices[faces]
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normals = np.zeros_like(positions)
    np.add.at(normals, weld[faces].ravel(), np.repeat(face_normals, 3, axis=0))
    lengths = np.linalg.norm(normals, axis=1)
    normals[lengths == 0] = (0, 0, 1)
    return (normals / np.linalg.norm(normals, axis=1)[:, None])[weld]


def mesh_primitive(glb, assets, shape, material, is_table):
    appearance = shape.get("appearance", {})
    if appearance.get("geometry") and appearance.get("texture"):
        with np.load(assets / appearance["geometry"]) as geometry:
            vertices, faces, uv = geometry["points"], geometry["faces"], geometry["uv"].copy()
        uv[:, 1] = 1 - uv[:, 1]
        with Image.open(assets / appearance["texture"]) as image:
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            texture_data = io.BytesIO()
            image.convert("RGB").save(texture_data, format="JPEG", quality=88)
        image_index = glb.add("images", {"bufferView": glb.view(texture_data.getvalue()),
                                        "mimeType": "image/jpeg"})
        material["baseColorTexture"] = {"index": glb.add("textures", {"source": image_index})}
        material["baseColorFactor"] = [1, 1, 1, 1]
    else:
        vertices, faces = read_obj(assets / shape["mesh"])
        uv = None

    vertices = vertices * shape["scale"]
    if is_table:
        # Preserve the tabletop's hard edges.
        vertices = vertices[faces.ravel()]
        faces = np.arange(len(vertices)).reshape(-1, 3)
        triangles = vertices[faces]
        normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        normals = np.repeat(normals / np.linalg.norm(normals, axis=1)[:, None], 3, axis=0)
    else:
        normals = vertex_normals(vertices, faces)

    attributes = {
        "POSITION": glb.accessor(vertices, "VEC3", target=34962, bounds=True),
        "NORMAL": glb.accessor(normals, "VEC3", target=34962),
    }
    if uv is not None:
        attributes["TEXCOORD_0"] = glb.accessor(uv, "VEC2", target=34962)
    return {
        "attributes": attributes,
        "indices": glb.accessor(faces.ravel(), "SCALAR",
                               "<u2" if len(vertices) < 65536 else "<u4", target=34963),
        "material": glb.add("materials", {"pbrMetallicRoughness": material}),
    }


def add_hand_skin(glb, path, side, rgb, bodies, body_node):
    with np.load(path) as skin:
        names, centers = skin["bodies"], skin["joints"]
        positions, faces = skin["vertices"], skin["faces"]
        # GLTFLoader supports four joint influences. Keep the largest weights.
        weights = skin["weights"]
        joints = np.argsort(weights, axis=1)[:, -4:]
        weights = np.take_along_axis(weights, joints, axis=1)
        weights /= weights.sum(axis=1, keepdims=True)
        joints[weights == 0] = 0

    by_name = {body["name"]: body for body in bodies.values() if body.get("side") == side}
    rest_positions = dict(zip(names, centers))
    for name, center in rest_positions.items():
        body = by_name[name]
        parent = bodies.get(body["parent"])
        parent_center = rest_positions[parent["name"]] if parent else 0
        joint = body["joint"]
        # The visual skin is bound to Newton's wrist-space, translation-only rest rig.
        if (not np.allclose(joint["X_p"][:3], center - parent_center, atol=1e-5)
                or not np.allclose(joint["X_p"][3:], [0, 0, 0, 1])
                or not np.allclose(joint["X_c"], [0, 0, 0, 0, 0, 0, 1])):
            raise ValueError(f"{path}: unsupported rest transform for {name}")

    inverse_bind = np.repeat(np.eye(4)[None], len(names), axis=0)
    inverse_bind[:, :3, 3] = -centers
    skin_index = glb.add("skins", {
        "joints": [body_node(by_name[name]["index"]) for name in names],
        "inverseBindMatrices": glb.accessor(inverse_bind.transpose(0, 2, 1), "MAT4"),
    })
    material = glb.add("materials", {
        "name": f"{side.capitalize()} hand",
        "pbrMetallicRoughness": {"baseColorFactor": [*rgb, 1], "metallicFactor": 0, "roughnessFactor": 0.82},
    })
    primitive = {
        "attributes": {
            "POSITION": glb.accessor(positions, "VEC3", target=34962, bounds=True),
            "NORMAL": glb.accessor(vertex_normals(positions, faces), "VEC3", target=34962),
            "JOINTS_0": glb.accessor(joints, "VEC4", "<u2", target=34962),
            "WEIGHTS_0": glb.accessor(weights, "VEC4", target=34962),
        },
        "indices": glb.accessor(faces.ravel(), "SCALAR", "<u2", target=34963),
        "material": material,
    }
    mesh = glb.add("meshes", {"primitives": [primitive]})
    node = glb.add("nodes", {"name": f"{side.capitalize()} visual hand", "mesh": mesh, "skin": skin_index})
    glb.doc["scenes"][0]["nodes"].append(node)


def export_contacts(source, frames, samples, fps, output):
    if not source.exists():
        output.unlink(missing_ok=True)
        return

    patches = []
    with np.load(source) as contacts:
        keys = set(contacts.files)
        recorded = np.array([f"{frame:06d}_tri" in keys for frame in frames])
        # Keep the exact frames where contact starts or ends, even between regular samples.
        changes = np.flatnonzero(recorded[1:] != recorded[:-1]) + 1
        samples = np.union1d(samples, changes)
        times = (frames[samples] - frames[0]) / fps
        for frame in frames[samples]:
            prefix = f"{frame:06d}"
            if f"{prefix}_tri" in keys:
                patches.append((contacts[f"{prefix}_tri"], -contacts[f"{prefix}_depth"]))
            else:
                patches.append((np.empty((0, 3, 3)), np.empty(0)))

    offsets = np.r_[0, np.cumsum([len(triangles) for triangles, _ in patches])]
    if offsets[-1] == 0:
        output.unlink(missing_ok=True)
        return

    positions = np.concatenate([triangles for triangles, _ in patches])
    depth = np.concatenate([depth for _, depth in patches])
    if not np.isfinite(positions).all() or not np.isfinite(depth).all():
        raise ValueError(f"{source}: contact patches contain non-finite values")
    origin = positions.min(axis=(0, 1))
    step = np.maximum((positions.max(axis=(0, 1)) - origin) / 65535, 1e-9)
    triangles = np.empty((len(positions), 10), dtype="<u2")
    triangles[:, :9] = np.clip(np.rint((positions - origin) / step), 0, 65535).reshape(-1, 9)
    triangles[:, 9] = np.clip(np.rint(depth * 1e7), 0, 65535)
    # Header, frame times, triangle offsets, then XYZ vertices and depth for each triangle.
    with output.open("wb") as file, gzip.GzipFile(fileobj=file, filename="", mode="wb", mtime=0) as packed:
        packed.write(struct.pack("<4sI6f", b"IPC1", len(times), *origin, *step))
        packed.write(np.asarray(times, dtype="<f4").tobytes())
        packed.write(np.asarray(offsets, dtype="<u4").tobytes())
        packed.write(triangles.tobytes())


def export_episode(dataset, episode, output):
    assets = dataset / "meta/assets"
    shapes = json.loads((assets / "shapes.json").read_text())["shapes"]
    bodies = {body["index"]: body for body in json.loads((assets / "bodies.json").read_text())["bodies"]}
    fps = json.loads((dataset / "meta/info.json").read_text())["fps"]
    with np.load(dataset / f"sim_state/episode_{episode:06d}.npz") as recording:
        frames = recording["frame_index"]
        if len(frames) < 2 or not np.all(np.diff(frames) > 0) or fps <= 0:
            raise ValueError("Expected at least two increasing frame indices and a positive frame rate")
        samples = np.r_[np.arange(0, len(frames) - 1, max(1, round(fps / 60))), len(frames) - 1]
        poses = recording["newton.body_q"][samples]
        times = (frames[samples] - frames[0]) / fps
    if not np.isfinite(poses).all() or np.any(np.linalg.norm(poses[:, :, 3:], axis=2) == 0):
        raise ValueError("Recording contains invalid body poses")

    glb = Glb()
    timeline = glb.accessor(times, "SCALAR", bounds=True)
    animation = {"name": "Recorded demonstration", "channels": [], "samplers": []}
    body_nodes = {}
    hand_colors = {"left": [0.28, 0.51, 0.81], "right": [0.71, 0.36, 0.32]}
    def body_node(body_index):
        if body_index in body_nodes:
            return body_nodes[body_index]
        positions = poses[:, body_index, :3]
        rotations = poses[:, body_index, 3:].copy()
        rotations /= np.linalg.norm(rotations, axis=1)[:, None]
        # Equivalent quaternion signs must follow a continuous sequence.
        changes = np.sum(rotations[:-1] * rotations[1:], axis=1) < 0
        rotations[1:] *= np.cumprod(np.where(changes, -1, 1))[:, None]
        node = glb.add("nodes", {
            "name": bodies[body_index]["unique_name"],
            "translation": positions[0].tolist(), "rotation": rotations[0].tolist(),
        })
        body_nodes[body_index] = node
        glb.doc["nodes"][0]["children"].append(node)
        for path, values, kind in (("translation", positions, "VEC3"), ("rotation", rotations, "VEC4")):
            if np.max(np.abs(values - values[0])) > 1e-6:
                sampler = len(animation["samplers"])
                animation["samplers"].append({"input": timeline, "output": glb.accessor(values, kind)})
                animation["channels"].append({"sampler": sampler, "target": {"node": node, "path": path}})

        return node

    skinned_sides = set()
    for side, rgb in hand_colors.items():
        rig = dataset / "meta/rig" / side / "skin.npz"
        if rig.exists():
            add_hand_skin(glb, rig, side, rgb, bodies, body_node)
            skinned_sides.add(side)

    for shape in shapes:
        body_index = shape["body"]
        if body_index < 0 or not shape["mesh"] or shape.get("appearance", {}).get("hidden"):
            continue
        body = bodies[body_index]
        if body.get("side") in skinned_sides:
            continue
        node = body_node(body_index)

        is_table = body["name"].lower() == "table"
        rgb = [0.24, 0.27, 0.32] if is_table else hand_colors.get(
            body.get("side"), shape.get("appearance", {}).get("rgb", [0.5, 0.5, 0.5]))
        material = {"baseColorFactor": [*rgb, 1], "metallicFactor": 0, "roughnessFactor": 0.82}
        primitive = mesh_primitive(glb, assets, shape, material, is_table)
        mesh = glb.add("meshes", {"primitives": [primitive]})
        position, rotation = shape["transform"][:3], np.asarray(shape["transform"][3:])
        child = glb.add("nodes", {"name": shape["label"].split("/")[-1], "mesh": mesh,
                                  "translation": position,
                                  "rotation": (rotation / np.linalg.norm(rotation)).tolist()})
        glb.doc["nodes"][node].setdefault("children", []).append(child)

    if not animation["channels"]:
        raise ValueError("No animated visual meshes found in the recording")
    glb.add("animations", animation)
    glb.write(output)
    export_contacts(dataset / f"contacts/hand_obj/episode_{episode:06d}.npz",
                    frames, samples, fps, output.with_suffix(".contacts.gz"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Recorded task directory containing meta/ and sim_state/")
    parser.add_argument("episode", type=int)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    export_episode(args.dataset, args.episode, args.output)
