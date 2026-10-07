import { useEffect, useState } from 'react';
import type { MiraState, Theme } from '../core/types';
import {
  loadAffectFollowing,
  loadTheme,
  saveAffectFollowing,
  saveTheme,
} from './app-preferences';

type AppPresentationStateOptions = {
  miraState: MiraState;
};

export function useAppPresentationState({ miraState }: AppPresentationStateOptions) {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [affectFollowing, setAffectFollowing] = useState(loadAffectFollowing);

  useEffect(() => {
    document.body.dataset.state = miraState;
    document.body.dataset.theme = theme;
  }, [miraState, theme]);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveAffectFollowing(affectFollowing);
  }, [affectFollowing]);

  return {
    theme,
    setTheme,
    affectFollowing,
    setAffectFollowing,
  };
}
