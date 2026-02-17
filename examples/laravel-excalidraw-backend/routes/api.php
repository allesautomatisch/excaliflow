<?php

use App\Http\Controllers\Api\DrawingController;
use Illuminate\Support\Facades\Route;

Route::prefix('v2')->group(function (): void {
    Route::post('post', [DrawingController::class, 'store']);
    Route::get('{id}', [DrawingController::class, 'show'])->where('id', '.+');
    Route::get('/', [DrawingController::class, 'index']);
    Route::get('{id}/meta', [DrawingController::class, 'showWithKey'])->where('id', '.+');
});
