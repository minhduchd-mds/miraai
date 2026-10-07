import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { SpatialObjectRuntime, SpatialObjectState } from '../core/vision/spatial-object';
import type { SpatialWorldRuntime } from '../core/vision/spatial-world';
import type { SpatialJointRuntime } from '../core/vision/spatial-joint';
import type { SpatialSelectionRuntime } from '../core/vision/spatial-layout';
import { spatialSessionLayoutRuntime } from '../core/vision/spatial-layout';
import { collectSpatialWorldAnchors } from './spatial-ui-helpers';

type SpatialLayoutLifecycleOptions = {
  active: boolean;
  spatialObjects: SpatialObjectState[];
  selectedClusterRoots: string[];
  objectRuntime: SpatialObjectRuntime;
  worldRuntime: SpatialWorldRuntime;
  jointRuntime: SpatialJointRuntime;
  selectionRuntime: SpatialSelectionRuntime;
  setSpatialObjects: Dispatch<SetStateAction<SpatialObjectState[]>>;
  setSelectedClusterRoots: Dispatch<SetStateAction<string[]>>;
  showFeedback: (message: string) => void;
};

export function useSpatialLayoutLifecycle({
  active,
  spatialObjects,
  selectedClusterRoots,
  objectRuntime,
  worldRuntime,
  jointRuntime,
  selectionRuntime,
  setSpatialObjects,
  setSelectedClusterRoots,
  showFeedback,
}: SpatialLayoutLifecycleOptions) {
  const layoutRef = useRef(spatialSessionLayoutRuntime());
  const skipCaptureRef = useRef(false);

  const captureSpatialLayout = useCallback(() => {
    layoutRef.current.capture({
      objects: objectRuntime.snapshot(),
      attachments: worldRuntime.attachmentSnapshot(),
      joints: jointRuntime.snapshot(),
      selectedClusterRoots: selectionRuntime.snapshot(),
    });
  }, [jointRuntime, objectRuntime, selectionRuntime, worldRuntime]);

  useEffect(() => {
    if (!active) return;
    const saved = layoutRef.current.restore();
    if (!saved) return;
    skipCaptureRef.current = true;

    for (const savedObject of saved.objects) {
      objectRuntime.setPose(savedObject.id, savedObject.pose);
    }

    worldRuntime.setAnchors(
      collectSpatialWorldAnchors(objectRuntime.snapshot()),
    );

    for (const attachment of saved.attachments) {
      const object = objectRuntime.get(attachment.objectId);
      if (!object) continue;
      const restored = worldRuntime.attachObject(
        attachment.objectId,
        attachment.anchorId,
        object.pose,
        attachment.attachedAt,
      );
      if (restored) {
        worldRuntime.updateAttachmentLocalPose(
          attachment.objectId,
          attachment.localPose,
        );
      }
    }

    jointRuntime.reset();
    for (const joint of saved.joints) jointRuntime.setJoint(joint);

    const selected = selectionRuntime.replace(saved.selectedClusterRoots);
    setSelectedClusterRoots(selected);

    for (const attachment of saved.attachments) {
      const resolved = worldRuntime.resolveObjectPose(attachment.objectId);
      if (resolved) objectRuntime.setPose(attachment.objectId, resolved);
    }

    setSpatialObjects(objectRuntime.snapshot());
    showFeedback('Đã khôi phục bố cục phiên');
  }, [
    active,
    jointRuntime,
    objectRuntime,
    selectionRuntime,
    setSelectedClusterRoots,
    setSpatialObjects,
    showFeedback,
    worldRuntime,
  ]);

  useEffect(() => {
    if (!active) return;
    if (skipCaptureRef.current) {
      skipCaptureRef.current = false;
      return;
    }

    layoutRef.current.capture({
      objects: spatialObjects,
      attachments: worldRuntime.attachmentSnapshot(),
      joints: jointRuntime.snapshot(),
      selectedClusterRoots,
    });
  }, [
    active,
    jointRuntime,
    selectedClusterRoots,
    spatialObjects,
    worldRuntime,
  ]);

  return {
    captureSpatialLayout,
  };
}
