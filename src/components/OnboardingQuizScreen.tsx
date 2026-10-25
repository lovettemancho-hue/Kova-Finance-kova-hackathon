import React, { useState } from 'react';
import { UserProfile } from '../types';
import { KovaAvatar } from './KovaAvatar';
import { ArrowRight, Sparkles, Check, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_COUNTRIES, getCurrencyForCountry, getCountryOption } from '../utils/currency';
import { CountrySearchSelect } from './CountrySearchSelect';

interface OnboardingQuizScreenProps {
  userFirstName?: string;
  userEmail?: string;
  onCompleteQuiz: (profile: UserProfile) => void;
}

export const OnboardingQuizScreen: React.FC<OnboardingQuizScreenProps> = ({
  userFirstName: propUserFirstName,
  userEmail: propUserEmail,
  onCompleteQuiz,
}) => {
  const { tempAuthUser } = useAuth();
  const userFirstName = propUserFirstName || tempAuthUser?.firstName || 'Friend';
  const userEmail = propUserEmail || tempAuthUser?.email || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [setupStatus, setSetupStatus] = useState('Aligning with your goals...');

  // Form State
  const [financialFeeling, setFinancialFeeling] = useState('');
  const [primaryMotivation, setPrimaryMotivation] = useState('');
  const [overspendTrigger, setOverspendTrigger] = useState('');
  const [country, setCountry] = useState('United States');
  const [preferredTone, setPreferredTone] = useState('');
  const [workingGoal, setWorkingGoal] = useState('');

  const questions = [
    {
      id: 'feeling',
      title: `Nice to meet you, ${userFirstName}. How do you feel talking about money, honestly?`,
      options: [
        'Stressed it out',
        'Avoid it mostly',
        'Fine, just disorganized',
        'Pretty on top of it',
      ],
      selected: financialFeeling,
      setSelected: setFinancialFeeling,
    },
    {
      id: 'country',
      title: 'Where are you based? (We will localize your currency & numbers)',
      isCountry: true,
      options: SUPPORTED_COUNTRIES.map((c) => c.countryName),
      selected: country,
      setSelected: setCountry,
    },
    {
      id: 'motivation',
      title: "What's pulling you toward Kova right now?",
      options: [
        'Want to save for something',
        'Trying to stop overspending',
        'Just want to understand my money better',
        'Recovering from a rough financial stretch',
      ],
      selected: primaryMotivation,
      setSelected: setPrimaryMotivation,
    },
    {
      id: 'trigger',
      title: 'When you overspend, what’s usually happening?',
      options: [
        'Stress or a bad day',
        'Social situations',
        'Impulse, no clear reason',
        "I don't really overspend",
      ],
      selected: overspendTrigger,
      setSelected: setOverspendTrigger,
    },
    {
      id: 'tone',
      title: 'How do you want Kova to talk to you?',
      options: [
        'Gently, ease me in',
        'Straight, tell me the truth',
        'Analytic, show me the numbers',
        'Warm, like a wise mentor',
      ],
      selected: preferredTone,
      setSelected: setPreferredTone,
    },
    {
      id: 'goal',
      title: 'One thing you’re working toward right now?',
      isText: true,
      options: ['A trip', 'An emergency fund', 'Paying off a card', 'A new camera'],
      selected: workingGoal,
      setSelected: setWorkingGoal,
    },
  ];

  const currentQ = questions[currentStep];

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Complete quiz & start transition with 3 smooth 800ms status text transitions (~2.5s total)
      setIsTransitioning(true);
      setSetupStatus('Aligning with your goals...');
      const selectedCurrency = getCurrencyForCountry(country);
      const profile: UserProfile = {
        firstName: userFirstName,
        email: userEmail,
        country: country || 'United States',
        currency: selectedCurrency || 'USD',
        financialFeeling: financialFeeling || 'Looking for balance',
        primaryMotivation: primaryMotivation || 'Understanding my money',
        overspendTrigger: overspendTrigger || 'Impulse',
        preferredTone: preferredTone || 'Gently, ease me in',
        workingGoal: workingGoal.trim() || 'A rainy day savings buffer',
        isCompletedOnboarding: true,
      };

      setTimeout(() => {
        setSetupStatus('Setting your preferred tone...');
      }, 800);

      setTimeout(() => {
        setSetupStatus('Ready.');
      }, 1600);

      setTimeout(() => {
        onCompleteQuiz(profile);
      }, 2400);
    }
  };

  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-6 font-sans">
        <div className="relative">
          <div className="absolute -inset-10 rounded-full bg-white/20 blur-2xl animate-ping" />
          <KovaAvatar size="lg" isPulsing={true} />
        </div>

        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-serif-headline text-white font-normal transition-all duration-300">
            {setupStatus}
          </h2>
          <p className="text-xs text-[#8A8A8E]">
            Attuning Kova to your preferred tone and financial rhythm for {workingGoal || 'your goals'}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-6 max-w-md mx-auto font-sans">
      {/* Header Step Counter */}
      <div className="flex items-center justify-between border-b border-[#2C2C2E]/60 pb-4">
        <div className="flex items-center gap-2">
          <KovaAvatar size="sm" isPulsing={true} />
          <span className="text-xs font-bold text-white">Getting to know you</span>
        </div>

        <div className="text-xs text-[#8A8A8E] font-medium">
          Step {currentStep + 1} of {questions.length}
        </div>
      </div>

      {/* Question Content */}
      <div className="my-auto py-6 space-y-6">
        {/* Progress Bar Line */}
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Kova Speaking Bubble */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#8A8A8E]">
            <Sparkles className="w-3.5 h-3.5 text-white/80" />
            <span>Kova asks:</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif-headline text-white leading-relaxed font-normal">
            "{currentQ.title}"
          </h2>
        </div>

        {/* Choices, Country Selector, or Input */}
        {currentQ.isText ? (
          <div className="space-y-3">
            <input
              type="text"
              value={workingGoal}
              onChange={(e) => setWorkingGoal(e.target.value)}
              placeholder="e.g. A trip to Japan, $5k emergency fund..."
              className="w-full bg-[#161618] border border-white/20 rounded-2xl p-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/50"
              autoFocus
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] text-[#8A8A8E] block w-full">Suggestions:</span>
              {currentQ.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWorkingGoal(opt)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                    workingGoal === opt
                      ? 'bg-white text-black border-white font-semibold'
                      : 'bg-white/5 text-[#8A8A8E] border-white/10 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (currentQ as any).isCountry ? (
          <div className="space-y-4">
            <div className="bg-[#161618] border border-white/15 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#8A8A8E]">
                <Globe className="w-4 h-4 text-white/70" />
                <span>Search & select your country (all 190+ ISO nations):</span>
              </div>

              <CountrySearchSelect
                value={country}
                onChange={(c) => setCountry(c.countryName)}
              />

              <div className="pt-2 text-xs text-[#8A8A8E] flex items-center justify-between border-t border-white/5">
                <span>Active Currency:</span>
                <span className="text-white font-mono font-semibold bg-white/10 px-2.5 py-1 rounded-lg">
                  {getCurrencyForCountry(country)} ({getCountryOption(country)?.symbol || '$'})
                </span>
              </div>
            </div>

            {/* Quick Suggested Country Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-[#8A8A8E] block">Quick suggestions:</span>
              <div className="flex flex-wrap gap-2">
                {['United States', 'United Kingdom', 'European Union (Eurozone)', 'Japan', 'Nigeria', 'Canada', 'Cameroon', 'Ghana', 'India', 'Australia'].map((cName) => {
                  const item = SUPPORTED_COUNTRIES.find((x) => x.countryName === cName);
                  if (!item) return null;
                  const isSelected = country === cName;
                  return (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => setCountry(cName)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black border-white font-semibold shadow-md'
                          : 'bg-white/5 text-[#8A8A8E] border-white/10 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span>{item.flag}</span>
                      <span>{item.countryName.split(' ')[0]}</span>
                      <span className="opacity-60 text-[10px]">({item.currencyCode})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentQ.options.map((option) => {
              const isSelected = currentQ.selected === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => currentQ.setSelected(option)}
                  className={`w-full p-4 rounded-[20px] text-left text-xs font-medium transition-all duration-200 border flex items-center justify-between ${
                    isSelected
                      ? 'bg-white text-black border-white font-semibold shadow-lg scale-[1.01]'
                      : 'glass-card text-white/90 border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <span>{option}</span>
                  {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        {currentStep > 0 ? (
          <button
            onClick={() => setCurrentStep((prev) => prev - 1)}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors"
          >
            Previous
          </button>
        ) : <div />}

        <button
          onClick={handleNext}
          disabled={!currentQ.selected && !currentQ.isText && !(currentQ as any).isCountry}
          className="bg-white text-black font-semibold text-xs px-7 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
        >
          <span>{currentStep === questions.length - 1 ? 'Meet Kova' : 'Next'}</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
