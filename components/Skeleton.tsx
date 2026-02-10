
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`}></div>
);

export const StatSkeleton = () => (
  <div className="bg-white p-8 rounded-[3rem] border border-orange-50 shadow-sm space-y-6">
    <Skeleton className="w-14 h-14 bg-orange-50" />
    <div className="space-y-2">
      <Skeleton className="w-24 h-10" />
      <Skeleton className="w-32 h-4" />
      <Skeleton className="w-20 h-3" />
    </div>
  </div>
);

export const QuizCardSkeleton = () => (
  <div className="bg-white rounded-[3.5rem] p-10 border border-orange-50 shadow-sm space-y-10">
    <div className="flex justify-between items-center">
      <Skeleton className="w-28 h-8 rounded-2xl" />
      <Skeleton className="w-16 h-6 rounded-xl" />
    </div>
    <div className="space-y-4">
      <Skeleton className="w-full h-8 rounded-xl" />
      <Skeleton className="w-3/4 h-8 rounded-xl" />
    </div>
    <Skeleton className="w-1/2 h-4 rounded-lg" />
    <div className="flex items-center justify-between pt-8 border-t border-gray-50 mt-auto">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <Skeleton className="w-24 h-4 rounded-lg" />
      </div>
      <Skeleton className="w-12 h-12 rounded-2xl" />
    </div>
  </div>
);

export const ListSkeleton = () => (
  <div className="p-6 flex items-center justify-between space-y-2">
    <div className="flex items-center gap-5">
      <Skeleton className="w-14 h-14 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
    </div>
    <div className="text-right space-y-2">
      <Skeleton className="w-24 h-6" />
      <Skeleton className="w-16 h-4 ml-auto" />
    </div>
  </div>
);
