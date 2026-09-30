<?php

namespace Tests\Unit;

use App\Models\Setting;
use App\Support\AttendanceRules;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceGpsRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_recent_accurate_gps_reading_is_accepted(): void
    {
        $now = Carbon::parse('2026-09-29 09:00:00', 'Asia/Jakarta');

        $result = AttendanceRules::validateGpsReading(
            5.552740480177099,
            95.33486560781716,
            25,
            ($now->getTimestamp() - 5) * 1000,
            $now
        );

        $this->assertTrue($result['valid']);
        $this->assertSame(5, $result['age_seconds']);
        $this->assertSame(25.0, $result['accuracy']);
    }

    public function test_zero_and_coarse_accuracy_are_rejected_with_retryable_codes(): void
    {
        $now = Carbon::parse('2026-09-29 09:00:00', 'Asia/Jakarta');
        $timestamp = $now->getTimestamp() * 1000;

        $zero = AttendanceRules::validateGpsReading(5.55, 95.33, 0, $timestamp, $now);
        $coarse = AttendanceRules::validateGpsReading(5.55, 95.33, 150, $timestamp, $now);

        $this->assertFalse($zero['valid']);
        $this->assertSame('GPS_ACCURACY_INVALID', $zero['code']);
        $this->assertTrue($zero['retryable']);

        $this->assertFalse($coarse['valid']);
        $this->assertSame('GPS_ACCURACY_TOO_LOW', $coarse['code']);
        $this->assertSame(150.0, $coarse['accuracy']);
        $this->assertTrue($coarse['retryable']);
    }

    public function test_cached_and_future_gps_readings_are_rejected(): void
    {
        $now = Carbon::parse('2026-09-29 09:00:00', 'Asia/Jakarta');

        $stale = AttendanceRules::validateGpsReading(
            5.55,
            95.33,
            20,
            ($now->getTimestamp() - 31) * 1000,
            $now
        );
        $future = AttendanceRules::validateGpsReading(
            5.55,
            95.33,
            20,
            ($now->getTimestamp() + 11) * 1000,
            $now
        );

        $this->assertFalse($stale['valid']);
        $this->assertSame('GPS_LOCATION_STALE', $stale['code']);
        $this->assertSame(31, $stale['age_seconds']);

        $this->assertFalse($future['valid']);
        $this->assertSame('GPS_TIMESTAMP_INVALID', $future['code']);
        $this->assertSame(-11, $future['age_seconds']);
    }

    public function test_geofence_accounts_for_accuracy_as_inside_uncertain_or_outside(): void
    {
        Setting::set('hospital_latitude', '0');
        Setting::set('hospital_longitude', '0');
        Setting::set('attendance_radius_meters', '100');

        $inside = AttendanceRules::evaluateGeofence(0, 0, 20);
        // Sekitar 80 meter dari titik pusat: rentang 50-110 meter.
        $uncertain = AttendanceRules::evaluateGeofence(0.0007195, 0, 30);
        // Sekitar 150 meter dari titik pusat: jarak terdekat masih > 100 meter.
        $outside = AttendanceRules::evaluateGeofence(0.001349, 0, 20);

        $this->assertSame('inside', $inside['status']);
        $this->assertTrue($inside['is_within']);

        $this->assertSame('uncertain', $uncertain['status']);
        $this->assertFalse($uncertain['is_within']);

        $this->assertSame('outside', $outside['status']);
        $this->assertFalse($outside['is_within']);
    }

    public function test_gps_thresholds_can_be_configured_safely(): void
    {
        Setting::set('gps_max_accuracy_meters', '75');
        Setting::set('gps_max_age_seconds', '15');
        $now = Carbon::parse('2026-09-29 09:00:00', 'Asia/Jakarta');

        $coarse = AttendanceRules::validateGpsReading(
            5.55,
            95.33,
            80,
            $now->getTimestamp() * 1000,
            $now
        );
        $stale = AttendanceRules::validateGpsReading(
            5.55,
            95.33,
            50,
            ($now->getTimestamp() - 16) * 1000,
            $now
        );

        $this->assertSame('GPS_ACCURACY_TOO_LOW', $coarse['code']);
        $this->assertSame(75.0, $coarse['max_accuracy_meters']);
        $this->assertSame('GPS_LOCATION_STALE', $stale['code']);
        $this->assertSame(15, $stale['max_age_seconds']);
    }
}
