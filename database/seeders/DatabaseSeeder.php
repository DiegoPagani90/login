<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Diego',
            'surname' => 'Pagani',
            'email' => 'diego@example.com',
            'password' => bcrypt('password'), // password

            // aggiunti
            'date_of_birth' => '1990-20-09',
            'gender' => 'male',
            'phone_number' => '1234567890',
            'place_of_birth' => 'Mariano Comense',
            'address' => 'Via Giacomo Matteotti',
            'civic_id' => '64',
            'city' => 'Cabiate',
            'state' => 'Italy',
            'zip_code' => '22060',
        ]);
    }
}
