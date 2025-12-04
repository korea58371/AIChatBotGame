'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AuthCodeError() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const error_description = searchParams.get('error_description');

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
            <div className="bg-gray-800 p-8 rounded-xl border border-red-500 shadow-2xl max-w-md w-full text-center">
                <h1 className="text-3xl font-bold text-red-500 mb-4">Login Failed</h1>
                <p className="text-gray-300 mb-6">
                    {error_description || "The login link is invalid or has expired."}
                </p>
                <p className="text-sm text-gray-500 mb-8">
                    Please try requesting a new magic link.
                </p>
                <Link
                    href="/"
                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    );
}
