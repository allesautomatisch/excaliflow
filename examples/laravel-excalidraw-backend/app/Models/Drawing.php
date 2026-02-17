<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Drawing extends Model
{
    protected $table = 'drawings';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'payload',
        'size_bytes',
        'owner_id',
        'project_id',
        'encryption_key',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
    ];
}
