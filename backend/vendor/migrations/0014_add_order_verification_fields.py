from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vendor', '0013_alter_order_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='customer_verified',
            field=models.BooleanField(default=False, help_text='Whether customer has verified receiving the order'),
        ),
        migrations.AddField(
            model_name='order',
            name='verification_timestamp',
            field=models.DateTimeField(blank=True, help_text='When customer verified the order', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_issue_reported',
            field=models.BooleanField(default=False, help_text='Whether customer reported not receiving the order'),
        ),
        migrations.AddField(
            model_name='order',
            name='issue_report_timestamp',
            field=models.DateTimeField(blank=True, help_text='When the delivery issue was reported', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='issue_description',
            field=models.TextField(blank=True, help_text='Description of the delivery issue', null=True),
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('accepted', 'Accepted'),
                    ('confirmed', 'Confirmed'),
                    ('rejected', 'Rejected'),
                    ('preparing', 'Preparing'),
                    ('ready', 'Ready for Pickup'),
                    ('delivered', 'Delivered'),
                    ('completed', 'Completed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='pending',
                max_length=20
            ),
        ),
    ]
