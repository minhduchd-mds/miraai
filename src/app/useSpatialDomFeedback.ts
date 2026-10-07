import { useEffect } from 'react';

const SPATIAL_TARGET_SELECTOR = '[data-spatial-action], [data-spatial-grab-handle], [data-spatial-object]';

type SpatialWorldDomLookup = {
  clusterRootObjectId: (id: string) => string;
};

type HumanHandContactDomState = {
  active: boolean;
  phase: string;
  pressure: number;
  primaryTargetId: string;
};

type SpatialDomFeedbackOptions = {
  focusId?: string;
  selectedClusterRoots: string[];
  selectionVersion: unknown;
  spatialWorld: SpatialWorldDomLookup;
  touchReady: boolean;
  touchTargetId: string;
  humanHandContact: HumanHandContactDomState;
};

function findSpatialTarget(id: string): HTMLElement | undefined {
  if (!id) return undefined;
  return Array.from(document.querySelectorAll<HTMLElement>(SPATIAL_TARGET_SELECTOR))
    .find((element) =>
      element.dataset.spatialAction === id ||
      element.dataset.spatialGrabHandle === id ||
      element.dataset.spatialObject === id
    );
}

export function useSpatialDomFeedback({
  focusId,
  selectedClusterRoots,
  selectionVersion,
  spatialWorld,
  touchReady,
  touchTargetId,
  humanHandContact,
}: SpatialDomFeedbackOptions) {
  useEffect(() => {
    const previouslyFocused = document.querySelectorAll<HTMLElement>('[data-spatial-focused="true"]');
    previouslyFocused.forEach((element) => element.removeAttribute('data-spatial-focused'));
    if (!focusId) return;

    const target = findSpatialTarget(focusId);
    target?.setAttribute('data-spatial-focused', 'true');
    return () => target?.removeAttribute('data-spatial-focused');
  }, [focusId]);

  useEffect(() => {
    const objects = document.querySelectorAll<HTMLElement>('[data-spatial-object]');
    objects.forEach((element) => element.removeAttribute('data-spatial-selected'));
    if (!selectedClusterRoots.length) return;

    objects.forEach((element) => {
      const id = String(element.dataset.spatialObject || '');
      if (!id) return;
      const root = spatialWorld.clusterRootObjectId(id);
      if (selectedClusterRoots.includes(root)) {
        element.setAttribute('data-spatial-selected', 'true');
      }
    });

    return () => objects.forEach((element) => element.removeAttribute('data-spatial-selected'));
  }, [selectedClusterRoots, selectionVersion, spatialWorld]);

  useEffect(() => {
    const previouslyTouched = document.querySelectorAll<HTMLElement>('[data-spatial-contacted="true"]');
    previouslyTouched.forEach((element) => element.removeAttribute('data-spatial-contacted'));
    if (!touchReady || !touchTargetId) return;

    const target = findSpatialTarget(touchTargetId);
    target?.setAttribute('data-spatial-contacted', 'true');
    return () => target?.removeAttribute('data-spatial-contacted');
  }, [touchReady, touchTargetId]);

  useEffect(() => {
    const previouslyHumanTouched = document.querySelectorAll<HTMLElement>('[data-spatial-human-contact]');
    previouslyHumanTouched.forEach((element) => {
      element.removeAttribute('data-spatial-human-contact');
      element.removeAttribute('data-spatial-pressed');
      element.style.removeProperty('--spatial-pressure');
    });
    if (!humanHandContact.active || !humanHandContact.primaryTargetId) return;

    const target = findSpatialTarget(humanHandContact.primaryTargetId);
    if (!target) return;

    target.setAttribute('data-spatial-human-contact', humanHandContact.phase);
    target.style.setProperty('--spatial-pressure', String(humanHandContact.pressure));
    if (humanHandContact.phase === 'press' || humanHandContact.phase === 'grab') {
      target.setAttribute('data-spatial-pressed', 'true');
    }

    return () => {
      target.removeAttribute('data-spatial-human-contact');
      target.removeAttribute('data-spatial-pressed');
      target.style.removeProperty('--spatial-pressure');
    };
  }, [
    humanHandContact.active,
    humanHandContact.phase,
    humanHandContact.pressure,
    humanHandContact.primaryTargetId,
  ]);
}
