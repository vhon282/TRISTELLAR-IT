import React from 'react';
import { ExternalLink, FileSpreadsheet, Pencil, Plus } from 'lucide-react';
import { GoogleSheetLink, GoogleSheetTargetModule } from '../../types/cmms';

interface ModuleGoogleSheetsBarProps {
  links: GoogleSheetLink[];
  moduleTarget: GoogleSheetTargetModule;
  onAddLink: (defaultTarget: GoogleSheetTargetModule) => void;
  onEditLink: (link: GoogleSheetLink) => void;
}

export const ModuleGoogleSheetsBar: React.FC<ModuleGoogleSheetsBarProps> = ({
  links,
  moduleTarget,
  onAddLink,
  onEditLink,
}) => {
  const matchingLinks = links.filter((l) => l.moduleTarget === moduleTarget);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {matchingLinks.map((link) => (
        <div
          key={link.id}
          className="inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 overflow-hidden shrink-0"
        >
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.description ? `${link.label} — ${link.description}` : `Open ${link.label} in Google Sheets`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{link.label}</span>
            <ExternalLink className="w-3 h-3 opacity-75 shrink-0" />
          </a>
          <button
            type="button"
            onClick={() => onEditLink(link)}
            aria-label={`Edit ${link.label} link`}
            title={`Edit ${link.label}`}
            className="px-1.5 py-1.5 text-emerald-700/75 dark:text-emerald-300/75 hover:text-emerald-900 dark:hover:text-emerald-100 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 border-l border-emerald-200/80 dark:border-emerald-800/70 transition-colors shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onAddLink(moduleTarget)}
        title="Add another Google Sheet link to this module"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
      >
        <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        <span>{matchingLinks.length === 0 ? 'Link Sheet' : 'Add Sheet'}</span>
      </button>
    </div>
  );
};
