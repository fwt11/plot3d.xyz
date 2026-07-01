import { useTranslation } from 'react-i18next';
import { Github, ExternalLink } from 'lucide-react';
import { RibbonGroup } from './RibbonGroup';

const GITHUB_URL = 'https://github.com/fwt11/plot3d.xyz';

export function AboutTab() {
  const { t } = useTranslation();

  const openGithub = () => {
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('about.project')}>
        <button
          onClick={openGithub}
          className="ribbon-btn"
          aria-label={t('about.githubRepo')}
          title={GITHUB_URL}
        >
          <Github size={20} />
          <span className="text-xs flex items-center gap-1">
            {t('about.github')}
            <ExternalLink size={10} />
          </span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={t('about.info')}>
        <div className="flex flex-col items-center justify-center px-3 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>plot3d.xyz</span>
          <span className="text-[11px]">{t('about.tagline')}</span>
        </div>
      </RibbonGroup>
    </div>
  );
}
