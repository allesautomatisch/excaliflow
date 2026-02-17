<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('drawings', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('name', 255)->nullable();
            $table->binary('payload');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('owner_id', 255)->nullable()->index();
            $table->string('project_id', 255)->nullable()->index();
            $table->string('encryption_key', 255)->nullable();
            $table->timestamps();

            $table->index('name');
            $table->index('updated_at');
            $table->index(['owner_id', 'updated_at']);
            $table->index(['project_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drawings');
    }
};
