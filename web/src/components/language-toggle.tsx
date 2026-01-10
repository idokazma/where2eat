'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'he' : 'en');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2 transition-all hover:scale-105"
      title={language === 'en' ? 'Switch to Hebrew' : 'Switch to English'}
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">
        {language === 'en' ? 'עברית' : 'English'}
      </span>
    </Button>
  );
}
