
import React from 'react';

interface SkeletonProps {
  className?: string;
  index?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, index = 0 }) => (
  <div 
    style={{ animationDelay: `${index * 100}ms` }}
    className={`relative overflow-hidden bg-gray-200/50 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-700 ${className}`}
  >
    {/* Shimmer Effect */}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
  </div>
);

export const StatSkeleton = ({ index = 0 }: { index?: number }) => (
  <div 
    style={{ animationDelay: `${index * 150}ms` }}
    className="bg-white p-8 rounded-[3rem] border border-orange-50 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700"
  >
    <Skeleton className="w-14 h-14 bg-orange-50" index={index} />
    <div className="space-y-3">
      <Skeleton className="w-24 h-10" index={index} />
      <Skeleton className="w-32 h-4" index={index} />
      <Skeleton className="w-20 h-2" index={index} />
    </div>
    
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes shimmer {
        100% { transform: translateX(100%); }
      }
    `}} />
  </div>
);

export const QuizCardSkeleton = ({ index = 0 }: { index?: number }) => (
  <div 
    style={{ animationDelay: `${index * 150}ms` }}
    className="bg-white rounded-[3.5rem] p-10 border border-orange-50 shadow-sm space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 h-full flex flex-col"
  >
    <div className="flex justify-between items-center">
      <Skeleton className="w-28 h-8 rounded-2xl" index={index} />
      <Skeleton className="w-16 h-6 rounded-xl" index={index} />
    </div>
    <div className="space-y-4">
      <Skeleton className="w-full h-8 rounded-xl" index={index} />
      <Skeleton className="w-3/4 h-8 rounded-xl" index={index} />
    </div>
    <Skeleton className="w-1/2 h-3 rounded-lg" index={index} />
    <div className="flex items-center justify-between pt-8 border-t border-gray-50 mt-auto">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-2xl" index={index} />
        <Skeleton className="w-24 h-4 rounded-lg" index={index} />
      </div>
      <Skeleton className="w-12 h-12 rounded-2xl" index={index} />
    </div>
  </div>
);

export const ListSkeleton = ({ index = 0 }: { index?: number }) => (
  <div 
    style={{ animationDelay: `${index * 100}ms` }}
    className="p-8 flex items-center justify-between space-x-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
  >
    <div className="flex items-center gap-5 flex-1">
      <Skeleton className="w-14 h-14 rounded-2xl shrink-0" index={index} />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-1/2 h-4" index={index} />
        <Skeleton className="w-1/3 h-3" index={index} />
      </div>
    </div>
    <div className="text-right space-y-2 w-24">
      <Skeleton className="w-full h-6 rounded-xl" index={index} />
      <Skeleton className="w-2/3 h-3 ml-auto" index={index} />
    </div>
  </div>
);
